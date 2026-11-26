// The med log's name suggestions (2.9): the list stays open on a name typed in full, Tab fills the highlighted
// suggestion (then moves on), and a name RAYDAR doesn't know is never swapped by tabbing past it.  npm run test:suggest
import { playwright, startRaydar, openPage } from './lib.mjs';

const { chromium } = playwright();
const srv = await startRaydar();
const browser = await chromium.launch();
const { page, errors } = await openPage(browser, srv.url);
let failed = 0;
const check = (ok, what, got) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + what + (ok ? '' : ' · got ' + JSON.stringify(got))); };

await page.evaluate(() => {
  const R = window.raydar; R.act('new'); const S = R.S;
  S.pid = 'p123456_0000'; S.dob = '1990-06-15'; S.match = true; R.act('confirm');
  R.act('logform'); R.commit();
});
await page.waitForTimeout(300);
const box = page.locator('[data-f="r.0.n"]');
const state = () => page.evaluate(() => {
  const el = document.querySelector('[data-f="r.0.n"]');
  const opts = [...document.querySelectorAll('.msug-o')].map((o) => o.querySelector('b, strong')?.textContent || o.textContent);
  return { value: el.value, focused: document.activeElement === el, opts, on: document.querySelector('.msug-o.on')?.textContent || '' };
});
const fresh = async () => { await box.click(); await box.fill(''); await page.waitForTimeout(50); };

// 1. Typed in full: the list is still there, with the name itself highlighted
await fresh(); await box.pressSequentially('Metformin', { delay: 15 }); await page.waitForTimeout(100);
let s = await state();
check(s.opts.length > 0 && /metformin/i.test(s.on), 'typed "Metformin" in full: suggestions still showing, Metformin highlighted', s);

// 2. Tab on a name already typed in full moves on to the next box
await page.keyboard.press('Tab'); await page.waitForTimeout(100);
s = await state();
check(!s.focused && /^metformin$/i.test(s.value), 'Tab on a full name: keeps it and moves to the next box', s);

// 3. Part of a name: Tab fills the highlighted suggestion and stays in the box
await fresh(); await box.pressSequentially('metf', { delay: 15 }); await page.waitForTimeout(100);
let before = await state();
await page.keyboard.press('Tab'); await page.waitForTimeout(100);
s = await state();
check(s.focused && s.value.toLowerCase() !== 'metf' && before.opts[0] && s.value.toLowerCase() === before.opts[0].trim().toLowerCase(), 'Tab on "metf": fills the first suggestion, stays in the box', { before: before.opts, ...s });
await page.keyboard.press('Tab'); await page.waitForTimeout(100);
s = await state();
check(!s.focused, 'second Tab moves on to the next box', s);

// 4. Arrow down then Tab fills the second suggestion
await fresh(); await box.pressSequentially('metf', { delay: 15 }); await page.waitForTimeout(100);
before = await state();
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab'); await page.waitForTimeout(100);
s = await state();
check(before.opts.length > 1 && s.value.toLowerCase() === before.opts[1].trim().toLowerCase(), 'ArrowDown then Tab fills the second suggestion', { before: before.opts, ...s });

// 5. A name RAYDAR doesn't know, with close spellings showing: Tab keeps what was typed
await fresh(); await box.pressSequentially('atorvastaten', { delay: 15 }); await page.waitForTimeout(100);
before = await state();
await page.keyboard.press('Tab'); await page.waitForTimeout(100);
s = await state();
check(before.opts.length > 0 && s.value === 'atorvastaten' && !s.focused, 'close spellings only: Tab keeps "atorvastaten" and moves on', { before: before.opts, ...s });

// 6. Shift+Tab never fills
await fresh(); await box.pressSequentially('metf', { delay: 15 }); await page.waitForTimeout(100);
await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(100);
s = await state();
check(s.value === 'metf' && !s.focused, 'Shift+Tab goes back without filling', s);

// 7. Enter on a suggestion fills the name only; the row is added by a second Enter (2.9 added it straight away)
await fresh(); await box.pressSequentially('metf', { delay: 15 }); await page.waitForTimeout(100);
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
let lg = await page.evaluate(() => ({ n: window.raydar.S.log.length, v: document.querySelector('[data-f="r.0.n"]')?.value }));
check(lg.n === 0 && /metformin/i.test(lg.v || ''), 'Enter on a suggestion fills the name and leaves the row open', lg);

// 8. Frequency (2.10): suggestions, Tab fills and stays, typed text is kept
const fr = page.locator('[data-f="r.0.fr"]');
await fr.click(); await fr.pressSequentially('twi', { delay: 15 }); await page.waitForTimeout(100);
await page.keyboard.press('Tab'); await page.waitForTimeout(100);
s = await page.evaluate(() => ({ v: document.querySelector('[data-f="r.0.fr"]').value, focused: document.activeElement === document.querySelector('[data-f="r.0.fr"]') }));
check(s.v === 'Twice daily' && s.focused, 'Frequency: Tab on "twi" fills Twice daily and stays in the box', s);
await fr.fill(''); await fr.pressSequentially('every 3 days', { delay: 10 }); await page.keyboard.press('Tab'); await page.waitForTimeout(100);
s = await page.evaluate(() => document.querySelector('[data-f="r.0.fr"]').value);
check(s === 'every 3 days', 'Frequency: text with no matching choice is kept as typed', s);

// 9. Enter adds the row, with the frequency shown on the logged medicine
await box.click(); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
lg = await page.evaluate(() => window.raydar.S.log.map((e) => [e.n, e.fr]));
const txt = await page.evaluate(() => document.body.innerText);
check(lg.length === 1 && lg[0][1] === 'every 3 days' && txt.includes('every 3 days'), 'Enter adds the row; the logged medicine shows its frequency', lg);

check(!errors.length, 'no page errors', errors);
await browser.close();
await srv.close();
console.log(failed ? '\n' + failed + ' failed' : '\nMedicine name suggestions work as expected.');
process.exit(failed ? 1 : 0);
