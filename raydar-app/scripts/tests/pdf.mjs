// Saves a PDF for each Finish outcome, checks its name, then reopens it with Import callback and checks the answers,
// PID, log and call notes come back. Uses a made-up PID; the PDFs go to the system temp folder.  npm run test:pdf
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { playwright, startRaydar, openPage } from './lib.mjs';

const { chromium } = playwright();
const OUT = mkdtempSync(path.join(tmpdir(), 'raydar-pdf-'));
const srv = await startRaydar();
const browser = await chromium.launch();
const { page, errors } = await openPage(browser, srv.url);
const setup = (code, wt, ht) => page.evaluate(([code, wt, ht]) => {
  const R = window.raydar; R.act('new'); const S = R.S;
  S.pid = 'p123456_0000'; S.dob = '1985-03-02'; S.match = true; R.act('confirm');
  S.nm = 'Test Person'; S.ph = '0400 000 000'; S.em = 'test@example.com'; S.pc = '3150'; // 2.11: bookings need these; the postcode comes back
  S.sex = 'f'; S.wt = wt; S.ht = ht; S.preg = 'n'; R.act('norest'); S.meds = 'n'; S.smoke = 'n';
  S.log.push({ t: 'med', n: 'Metformin', ind: 'Type 2 diabetes', dose: '500 mg', fr: 'Twice daily', route: 'Oral', st: '2021', en: '', src: 'Test', auto: null, f: false }); // 2.10: frequency comes back
  R.act('start:' + code);
  const s = R.S.study; if (s.cohorts) { const c = s.cohorts.find((c) => R.cStat(c) === 'open'); if (c) R.act('avail:' + s.c + ':' + c.id); R.act('dok'); }
  R.act('read'); R.act('startq'); R.commit();
}, [code, wt, ht]);
const answer = async (max) => { for (let i = 0; i < max; i++) { const d = await page.evaluate(() => window.raydar.psDone()); if (d) break; await page.evaluate(() => { const R = window.raydar, { q } = R.curQ(); if (q.kind === 'text') { R.S.txt[q.id] = '70'; R.act('anst:' + q.id); } else if (q.kind === 'multi') R.act('ansm:' + q.id); else R.act('ans:' + R.ansOrder(q)[0]); }); } };
const save = async (fin, acts) => {
  await page.evaluate(([fin, acts]) => { const R = window.raydar; R.S.saved = false; R.act('go:finish'); R.act('fin:' + fin); (acts || []).forEach((a) => R.act(a)); R.S.finalNotes = 'Test note'; R.commit(); }, [fin, acts]);
  await page.waitForTimeout(250);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Save PDF")')]);
  const name = dl.suggestedFilename(); await dl.saveAs(path.join(OUT, name));
  return { name, n: await page.evaluate(() => Object.keys(window.raydar.S.out).length) };
};
const cases = [];
await setup('SRSD', '90', '170'); await answer(400); cases.push(['Clear to book', await save('c'), /-SRSD384-101-Booked\.pdf$/]);
await setup('SRSD', '60', '160'); await answer(6); cases.push(['Exclude', await save('x'), /-Fail_Outside_BMI_26_41/]);
await setup('CORSERA', '62', '175'); await answer(400);
cases.push(['Doctor enquiry, hold', await save('d', ['drmode:hold']), /-COR-PAG-26-101-Callback_Doctor_enquiry_pending\.pdf$/]);
cases.push(['Doctor enquiry, book', await save('d', ['drmode:book']), /-Booked_DrEnquiry\.pdf$/]);
await setup('V175-001 SYD', '70', '170'); await answer(8);
cases.push(['Callback', await save('cb', ['cbr:' + encodeURIComponent('No available slots')]), /-V175-001-Callback_No_available_slots\.pdf$/]);
let failed = 0;
for (const [label, r, re] of cases) {
  await page.evaluate(() => window.raydar.act('new')); await page.waitForTimeout(100);
  await page.setInputFiles('input[type=file]', path.join(OUT, r.name)); await page.waitForTimeout(700);
  const back = await page.evaluate(() => { const S = window.raydar.S; return { pid: S.pid, n: Object.keys(S.out).length, notes: S.finalNotes, ok: S.impMsg && S.impMsg.ok, fr: (S.log.find((e) => e.n === 'Metformin') || {}).fr, pc: S.pc, nm: S.nm }; });
  // the age question is asked again after reopening (the date of birth is never stored in the file)
  const ok = re.test(r.name) && back.ok && back.pid === 'p123456_0000' && back.n >= r.n - 1 && back.notes === 'Test note' && back.fr === 'Twice daily' && back.pc === '3150' && !back.nm;
  if (!ok) failed++;
  console.log((ok ? 'ok   ' : 'FAIL ') + label.padEnd(22) + r.name + ' · ' + back.n + '/' + r.n + ' answers back' + (back.fr === 'Twice daily' ? ', frequency back' : ', FREQUENCY MISSING'));
}
if (errors.length) { failed++; console.log('Page errors: ' + errors.slice(0, 3).join(' | ')); }
await browser.close(); await srv.close();
console.log(failed ? '\n' + failed + ' failed (PDFs kept in ' + OUT + ')' : '\nEvery outcome saves and reopens.');
process.exit(failed ? 1 : 0);
