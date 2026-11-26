// Test mode (RAYDAR 2.10): switch on from the Identity screen, open a study straight at its questions with no
// identity, date or study-info checks, jump to any section, see questions earlier answers would hide, save a PDF
// stamped TEST, reopen it in test mode, and come back to a clean normal call.  npm run test:testmode
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { playwright, startRaydar, openPage } from './lib.mjs';

const { chromium } = playwright();
const OUT = mkdtempSync(path.join(tmpdir(), 'raydar-tm-'));
const srv = await startRaydar();
const browser = await chromium.launch();
const { page, errors } = await openPage(browser, srv.url);
let failed = 0;
const check = (ok, what, got) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + what + (ok ? '' : ' · got ' + JSON.stringify(got))); };
const st = () => page.evaluate(() => { const R = window.raydar, S = R.S; return { tm: S.tm, idok: S.idok, stage: S.stage, qon: S.qon, pid: S.pid, study: S.study && S.study.c, prev: !!R.prevCall(), body: document.body.classList.contains('tm'), banner: !!document.querySelector('.tmbar'), head: (document.querySelector('#rd .bar') || {}).innerText || '' }; });

// a real call is under way when test mode is switched on from Tools
await page.evaluate(() => { const R = window.raydar, S = R.S; S.pid = 'p123456_0000'; S.dob = '1990-06-15'; S.match = true; R.act('confirm'); R.commit(); });
await page.evaluate(() => { window.raydar.act('new'); window.raydar.commit(); });
await page.waitForTimeout(200);

// 1. on from the Identity screen
await page.click('button:has-text("Explore in test mode")'); await page.waitForTimeout(250);
let s = await st();
check(s.tm && s.idok && s.stage === 'qc' && !s.pid, 'Explore in test mode: identity skipped, no PID, on to Quick check', s);
check(s.body && s.banner && /Test mode/.test(s.head), 'test mode is marked: banner, pink frame, "Test mode" in the header', s);

// 2. any study opens straight at its questions, with questions earlier answers would hide
await page.evaluate(() => { const R = window.raydar; R.act('start:' + R.ranked(true).map((x) => x.s.c).find((c) => /D7260/.test(c))); R.commit(); });
await page.waitForTimeout(250);
let q = await page.evaluate(() => { const R = window.raydar, L = R.qset(); return { qon: R.S.qon, stage: R.S.stage, n: L.length, hid: L.filter((z) => R.isHiddenQ(z.id)).length, secs: [...new Set(L.map((z) => z.sec))] }; });
check(q.stage === 'ps' && q.qon, 'a study opens straight at its questions (no dates or study info first)', q);
check(q.hid > 0, 'questions earlier answers would hide are shown (' + q.hid + ' of ' + q.n + ')', q);
const lastSec = q.secs[q.secs.length - 1];
await page.click('button:has-text("' + lastSec.slice(0, 18).replace(/"/g, '\\"') + '")'); await page.waitForTimeout(200);
const cur = await page.evaluate(() => window.raydar.curQ().q.sec);
check(cur === lastSec, 'the last section opens straight away', cur);
await page.keyboard.press('1'); await page.waitForTimeout(150);
const answered = await page.evaluate(() => Object.keys(window.raydar.S.out).length);
check(answered === 1, 'questions can still be answered', answered);
await page.click('label.tmtog'); await page.waitForTimeout(150);
q = await page.evaluate(() => { const R = window.raydar, L = R.qset(); return { n: L.length, hid: L.filter((z) => R.isHiddenQ(z.id)).length }; });
check(q.hid === 0, 'switching off "Show questions hidden by earlier answers" hides them again', q);
await page.click('label.tmtog'); await page.waitForTimeout(100);

// 3. the PDF is stamped TEST and named TEST-…, and the Dr enquiry text says so
const dr = await page.evaluate(() => window.raydar.drText());
check(/^TEST MODE/.test(dr), 'the Dr enquiry text starts "TEST MODE"', dr.slice(0, 40));
await page.evaluate(() => { const R = window.raydar; R.act('go:finish'); R.act('fin:cb'); R.act('cbr:' + encodeURIComponent('No available slots')); R.commit(); });
await page.waitForTimeout(250);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Save PDF")')]);
const name = dl.suggestedFilename(); await dl.saveAs(path.join(OUT, name));
check(/^TEST-/.test(name) && !/NoPID/.test(name), 'the PDF name starts TEST- (no PID)', name);
const raw = readFileSync(path.join(OUT, name)).toString('latin1');
check(/TEST, NOT A REAL PRE-SCREEN/.test(raw) && /test_mode/.test(raw), 'the PDF is stamped TEST and marked as a test', name);

// 4. a new call stays in test mode, and is never offered by "Back to the last call"
await page.evaluate(() => { window.raydar.act('new'); window.raydar.commit(); }); await page.waitForTimeout(150);
s = await st();
check(s.tm && s.idok && s.stage === 'qc' && s.prev, 'Start next call stays in test mode; the real call before it is still the last call', s);

// 5. back to normal mode: a clean call, nothing marked, and the real call can be reopened
await page.click('.tmbar button:has-text("Back to normal mode")'); await page.waitForTimeout(250);
s = await st();
check(!s.tm && !s.idok && s.stage === 'id' && !s.body && !s.banner, 'Back to normal mode: a clean call, banner and frame gone', s);
const last = await page.locator('button:has-text("Back to the last call")').count();
check(last === 1, '"Back to the last call" offers the real call, not a test one', last);

// 6. a test PDF reopens in test mode
await page.setInputFiles('input[type=file]', path.join(OUT, name)); await page.waitForTimeout(700);
s = await st();
check(s.tm && s.idok && s.study, 'a test-mode PDF reopens in test mode', s);
await page.evaluate(() => { window.raydar.act('tmoff'); window.raydar.commit(); });

check(!errors.length, 'no page errors', errors);
await browser.close();
await srv.close();
console.log(failed ? '\n' + failed + ' failed (PDF kept in ' + OUT + ')' : '\nTest mode works as expected.');
process.exit(failed ? 1 : 0);
