// Participant details and travel time (RAYDAR 2.11): the identity boxes, name/phone/email never saved to any file,
// and Travel opening Google Maps from the postcode to the right place.  npm run test:details
// Uses made-up details (p123456_0000, "Test Person", test@example.com); nothing real.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { playwright, startRaydar, openPage } from './lib.mjs';

const { chromium } = playwright();
const OUT = mkdtempSync(path.join(tmpdir(), 'raydar-details-'));
const srv = await startRaydar();
const browser = await chromium.launch();
const { page, errors } = await openPage(browser, srv.url);
let failed = 0;
const check = (ok, what, got) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + what + (ok ? '' : ' · got ' + JSON.stringify(got))); };
const popupUrl = async (click) => { const [p] = await Promise.all([page.context().waitForEvent('page'), click()]); const u = p.url(); await p.close(); return decodeURIComponent(u); };
await page.context().route(/google\.com/, (r) => r.fulfill({ status: 200, body: 'ok' }));

// 1. the identity check asks for name, phone, email and postcode
for (const f of ['nm', 'ph', 'em', 'pc']) check(await page.locator('[data-f="' + f + '"]').count() === 1, 'identity box ' + f + ' is there');
await page.fill('[data-f="pid"]', 'p123456_0000');
await page.fill('[data-f="dob"]', '1970-06-15');
let still = await page.locator('text=Still needed').count();
check(still === 1, '"Still needed" shows while name, phone and email are empty', still);
await page.fill('[data-f="nm"]', 'Test Person');
await page.fill('[data-f="ph"]', '0400 000 000');
await page.fill('[data-f="em"]', 'test@example.com');
await page.fill('[data-f="pc"]', '31a50');
check(await page.inputValue('[data-f="pc"]') === '3150', 'the postcode box keeps four digits only', await page.inputValue('[data-f="pc"]'));
still = await page.locator('text=Still needed').count();
check(still === 0, '"Still needed" goes once they are filled in', still);
await page.check('[data-f="match"]');
await page.focus('[data-f="em"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
check(await page.evaluate(() => window.raydar.S.stage) === 'qc', 'Enter in the email box confirms identity and goes on to Quick check');

// 2. Travel in the header, before a study: the three sites
const chip = page.locator('.tv-chip');
check(await chip.count() === 1 && /3150/.test(await chip.innerText()), 'the header shows "3150 · Travel"');
await chip.click(); await page.waitForTimeout(100);
const sites = await page.locator('.tv-pop .tv-row').allInnerTexts();
check(sites.length === 3 && sites.some((t) => /1096 Toorak Rd, Camberwell/.test(t)) && sites.some((t) => /Suite 2\/12 Lord St, Botany/.test(t)) && sites.some((t) => /885 Mountain Hwy, Bayswater/.test(t)), 'before a study, Travel lists the three sites', sites);
let url = await popupUrl(() => page.locator('.tv-pop .tv-row').first().locator('button:has-text("By car")').click());
check(/origin=3150 VIC Australia/.test(url.replace(/\+/g, ' ')) && /travelmode=driving/.test(url), 'By car opens Google Maps from 3150 VIC', url);
await page.keyboard.press('Escape');

// 3. Quick check: travel is optional and only noted
await page.click('.seg button:has-text("Too far")');
check(await page.evaluate(() => window.raydar.S.tvOk) === 'far', 'Quick check notes "Too far" (no rule)');

// 4. the study list: SRSD's site and its MRI scans
await page.evaluate(() => { window.raydar.S.all = true; window.raydar.commit(); }); await page.waitForTimeout(200);
await page.locator('#rail .mono', { hasText: /^SRSD\b/ }).first().locator('.tv-link').click(); await page.waitForTimeout(100);
const srsdPlaces = await page.locator('.tv-pop .tv-row').allInnerTexts();
check(srsdPlaces.length === 2 && /Lord St, Botany/.test(srsdPlaces[0]) && /Mons Rd, Westmead/.test(srsdPlaces[1]), 'SRSD: the Botany site and the MRI scans in Westmead', srsdPlaces);
url = await popupUrl(() => page.locator('.tv-pop .tv-row').nth(1).locator('button:has-text("Public transport")').click());
check(/destination=20-22 Mons Rd, Westmead NSW 2145/.test(url.replace(/\+/g, ' ')) && /travelmode=transit/.test(url), 'Public transport opens Google Maps to Westmead', url);
await page.keyboard.press('Escape');

// 5. a question that names the study's address gets a travel button to it (EMBOLD: Camberwell; CORSERA: Bayswater)
for (const [code, place] of [['D7260', '1096 Toorak Rd'], ['CORSERA', '885 Mountain Hwy']]) {
  await page.evaluate((code) => { const R = window.raydar, S = R.S; S.sex = 'f'; S.wt = '75'; S.ht = '172'; S.preg = 'n'; R.act('norest'); S.meds = 'n'; S.smoke = 'n';
    R.act('start:' + R.ranked(true).map((x) => x.s.c).find((c) => c.startsWith(code))); const s = R.S.study;
    if (s.cohorts) { const c = s.cohorts.find((c) => R.cStat(c) === 'open'); if (c) R.act('avail:' + s.c + ':' + c.id); R.act('dok'); } R.act('read'); R.act('startq');
    const q = R.qset().find((z) => /travel/i.test(z.t) && /\d+ \w+ (Rd|Hwy|St)/.test(z.r || '')); if (q) R.act('goq:' + q.id); R.commit(); }, code);
  await page.waitForTimeout(250);
  const b = page.locator('.tv-q-row .tv-btn');
  check(await b.count() === 1 && (await b.innerText()).includes(place), code + ': the travel question has "Travel from 3150 to ' + place + '"', await b.count() ? await b.innerText() : null);
}

// 6. name, phone and email never reach a file or the Dr enquiry
const dr = await page.evaluate(() => window.raydar.drText());
check(!/Test Person|0400 000 000|test@example\.com/.test(dr), 'the Dr enquiry text has no name, phone or email');
await page.evaluate(() => { const R = window.raydar; R.act('go:finish'); R.act('fin:cb'); R.act('cbr:' + encodeURIComponent('No available slots')); R.commit(); });
await page.waitForTimeout(250);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Save PDF")')]);
const file = path.join(OUT, dl.suggestedFilename()); await dl.saveAs(file);
const raw = readFileSync(file).toString('latin1');
check(!/Test Person|0400 000 000|test@example\.com/.test(raw), 'the PDF has no name, phone or email', dl.suggestedFilename());

// 7. without a postcode, Travel asks for one
await page.evaluate(() => { const R = window.raydar; R.act('new'); R.S.pid = 'p123456_0000'; R.S.dob = '1970-06-15'; R.S.match = true; R.act('confirm'); R.commit(); });
await page.waitForTimeout(150);
await page.locator('.row', { hasText: 'Travel to the study sites' }).locator('.tv-btn').click(); await page.waitForTimeout(100);
check(await page.locator('.tv-pop .tv-pc input').count() === 1 && await page.locator('.tv-pop button:has-text("By car")').count() === 0, 'with no postcode, Travel asks for one first');
await page.fill('.tv-pop .tv-pc input', '2019'); await page.waitForTimeout(100);
check(await page.locator('.tv-pop button:has-text("By car")').count() === 3, 'typing a postcode there shows the places');

// 8. before a booking, missing name, phone or email are asked for; other outcomes aren't held up
await page.evaluate(() => { const R = window.raydar; R.act('new'); const S = R.S; S.pid = 'p123456_0000'; S.dob = '1970-06-15'; S.match = true; R.act('confirm'); R.act('go:finish'); R.act('fin:c'); R.commit(); });
await page.waitForTimeout(250);
let save = page.locator('button:has-text("Save PDF")');
check(await page.locator('.need').count() === 1 && await save.isDisabled(), 'Clear to book with no details: asks for them, Save PDF waits', await page.locator('.need').count());
await page.evaluate(() => { window.raydar.act('fin:cb'); window.raydar.commit(); }); await page.waitForTimeout(150);
check(await page.locator('.need').count() === 0 && !(await save.isDisabled()), 'Save for callback: not held up');
await page.evaluate(() => { window.raydar.act('fin:c'); window.raydar.commit(); }); await page.waitForTimeout(150);
await page.fill('[data-f="fin-nm"]', 'Test Person'); await page.fill('[data-f="fin-ph"]', '0400 000 000'); await page.fill('[data-f="fin-em"]', 'test@example.com');
await page.waitForTimeout(100);
check(await page.locator('.need').count() === 0 && !(await save.isDisabled()), 'once filled in at Finish, the booking can be saved');

// 9. a strip above the question when the questions move into a new section (F1), folding away after a few seconds
await page.evaluate(() => { const R = window.raydar; R.act('new'); const S = R.S; S.pid = 'p123456_0000'; S.dob = '1970-06-15'; S.match = true; R.act('confirm'); S.sex = 'f'; S.wt = '75'; S.ht = '172'; S.preg = 'n'; R.act('norest'); S.meds = 'n'; S.smoke = 'n';
  R.act('start:' + R.ranked(true).map((x) => x.s.c).find((c) => /D7260/.test(c))); const s = R.S.study; if (s.cohorts) { const c = s.cohorts.find((c) => R.cStat(c) === 'open'); if (c) R.act('avail:' + s.c + ':' + c.id); R.act('dok'); } R.act('read'); R.act('startq'); R.commit(); });
await page.waitForTimeout(300);
check(await page.locator('.secnote').count() === 0, 'no section strip on the first question');
const secs = await page.evaluate(() => { const L = window.raydar.qset(); return [...new Set(L.map((q) => q.sec))]; });
await page.evaluate((sec) => { window.raydar.act('sec:' + encodeURIComponent(sec)); window.raydar.commit(); }, secs[1]); await page.waitForTimeout(500);
const note = await page.locator('.secnote').count() ? await page.locator('.secnote').innerText() : '';
check(note.includes(secs[1]) && /Section 2 of/.test(note), 'moving into the next section shows "New section: ' + secs[1] + '"', note);
await page.mouse.move(5, 5); await page.waitForTimeout(6000);
check(await page.locator('.secnote').count() === 0, 'the strip folds away after a few seconds');

check(!errors.length, 'no page errors', errors);
await browser.close();
await srv.close();
console.log(failed ? '\n' + failed + ' failed' : '\nParticipant details and travel time work as expected.');
process.exit(failed ? 1 : 0);
