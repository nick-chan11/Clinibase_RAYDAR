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

// 10. The prohibited-list search (2.10): suggestions as you type, with the study's result and tags
await page.evaluate(() => { const R = window.raydar; R.S.proS = R.ranked(true).map((x) => x.s.c).find((c) => /D7260/.test(c)); R.commit(); });
const sb = page.locator('input[aria-label="Search the list"]');
const look = async (q) => { await sb.fill(''); await sb.pressSequentially(q, { delay: 8 }); await page.waitForTimeout(150);
  return page.evaluate(() => { const b = document.querySelector('.lbox'); const m = document.querySelector('.mlook');
    return { head: b ? b.querySelector('.lbox-h').innerText : '', rows: [...document.querySelectorAll('.lrow')].map((r) => r.innerText), on: (document.querySelector('.lrow.on') || {}).innerText || '', msg: m ? m.innerText : '' }; }); };
let L = await look('metformi');
check(/1 medicine starts/.test(L.head) && /^Metformin/.test(L.rows[0]), 'search "metformi": suggests Metformin', L);
L = await look('quetiap');
check(/Quetiapine/.test(L.on) && /Excluded/.test(L.on) && /Antipsychotics/.test(L.on) && !/isn.t a medicine/.test(L.msg), 'search "quetiap": Quetiapine, Excluded, drug class shown, no "doesn\'t know"', L.on);
L = await look('insulin');
check(L.rows.length === 15 && /15 medicines start/.test(L.head), 'search "insulin": all 15 insulins listed', L.head);
L = await look('seroquel');
check(/ACTIVE INGREDIENT\s*quetiapine/i.test(L.on) && /SAME AS/i.test(L.on), 'search "seroquel": active ingredient and other brands tagged', L.on);
L = await look('mounjaro');
check(/Excluded/.test(L.on) && /Incretins/.test(L.on), 'search "mounjaro": excluded on EMBOLD under Incretins', L.on);
L = await look('atorvastaten');
check(/Closest spellings/.test(L.head) && /Atorvastatin/.test(L.rows[0] || ''), 'search "atorvastaten": closest spellings, no "doesn\'t know"', L);
L = await look('zelvorin');
check(/doesn't recognise/.test(L.msg) && !L.rows.length, 'search "zelvorin": the only one that says RAYDAR doesn\'t recognise it', L.msg);
await look('ozem'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
const v = await sb.inputValue();
check(v && v !== 'ozem' && !/ozempic/i.test(v), 'search: ArrowDown then Enter picks the second suggestion', v);
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
check((await sb.inputValue()) === '', 'search: Esc clears the box', await sb.inputValue());

// 11. Check a list (2.11): one per line, spelling fixed, choices, all added to the med log
await page.click('.lc-mode button:has-text("Check a list")'); await page.waitForTimeout(100);
await page.fill('[data-f="rlist"]', 'metfor,in\nForxiga\njardiance\njardiamet\nozempic 1mg weekly\nsertaline\nblood pressure tablet');
check(/Check 7 medicines/.test(await page.locator('.lc-go .pill').innerText()), 'Check a list counts 7 lines');
await page.focus('[data-f="rlist"]'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(200);
let lc = await page.$$eval('.lc-line', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
check(/^Metformin/.test(lc[0]) && /Spelling fixed from "metfor,in"/.test(lc[0]), 'metfor,in → Metformin, spelling fixed', lc[0]);
check(/^Forxiga.*dapagliflozin/.test(lc[1]) && /^Jardiance.*empagliflozin/.test(lc[2]) && /^Jardiamet.*empagliflozin \+ metformin/.test(lc[3]), 'Forxiga, Jardiance and Jardiamet read with their ingredients', lc.slice(1, 4));
check(/^Ozempic.*1mg weekly.*Excluded.*Incretins/.test(lc[4]), 'ozempic 1mg weekly: Excluded on EMBOLD, details kept', lc[4]);
check(/sertaline.*Did you mean\?.*Sertraline.*Serapine.*None of these/.test(lc[5]), 'sertaline: Did you mean Sertraline or Serapine, or None of these', lc[5]);
check(/Blood pressure tablet.*Not recognised.*Kept as typed/.test(lc[6]), 'blood pressure tablet: not recognised, kept as typed', lc[6]);
check(/Add these 7 to the med log\?/.test(await page.locator('.lc .lc-ask').innerText()) && /Choose for 1 line/.test(await page.locator('.lc .lc-ask').innerText()) && await page.locator('.lc .lc-ask button:has-text("Add all 7")').isDisabled(), 'right after checking: "Add these 7 to the med log?", waiting for the one choice');
await page.click('.lc-chip:has-text("Sertraline")'); await page.waitForTimeout(100);
await page.evaluate(() => { window.raydar.S.log = []; window.raydar.commit(); });

await page.click('.lc .lc-ask button:has-text("Add all 7")'); await page.waitForTimeout(150);
const added = await page.evaluate(() => window.raydar.S.log.filter((e) => e.src === 'Prohibited list check').map((e) => [e.n, e.dose, e.fr]));
check(added.length === 7 && added.some((x) => x[0] === 'Ozempic' && x[1] === '1mg' && x[2] === 'weekly') && added.some((x) => x[0] === 'Sertraline') && added.some((x) => x[0] === 'Blood pressure tablet'), 'Add all puts all 7 in the med log, with dosage and frequency', added);
check(/Added 7 to the med log/.test(await page.locator('.lc .lc-ask').innerText()), 'it says they were added, details to fill in later', await page.locator('.lc .lc-ask').innerText());
await page.focus('[data-f="rlist"]'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(150);
await page.click('.lc-chip:has-text("Sertraline")'); await page.click('.lc .lc-ask button:has-text("Add all")'); await page.waitForTimeout(150);
check(/already in the med log/.test(await page.locator('.lc .lc-ask').innerText()) && (await page.evaluate(() => window.raydar.S.log.length)) === 7, 'checking the same list again adds nothing twice');

// 12. "Not now" puts the prompt away; adding is still possible under the results
await page.focus('[data-f="rlist"]'); await page.fill('[data-f="rlist"]', 'panadol'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(150);
await page.click('.lc .lc-ask button:has-text("Not now")'); await page.waitForTimeout(100);
check(await page.locator('.lc .lc-ask').count() === 0 && await page.locator('.lc-sum button:has-text("Add all 1 to the med log")').count() === 1, '"Not now" hides the prompt; Add all stays under the results');

// 13. Fill in details, one by one: each medicine from the list without details opens in turn
let todo = await page.evaluate(() => window.raydar.S.log.filter((e) => e.src === 'Prohibited list check' && !e.dose && !e.fr && !e.route && !e.ind).length);
check(todo === 6 && /6 from the list still need details/.test(await page.locator('#rail').innerText()), 'the med log says 6 from the list still need details', todo);
await page.click('#rail button:has-text("Fill in details, one by one")'); await page.waitForTimeout(200);
const first = await page.inputValue('[data-f="r.0.n"]');
await page.fill('[data-f="r.0.dose"]', '500 mg'); await page.fill('[data-f="r.0.fr"]', 'Twice daily');
await page.click('#rail button:has-text("Save and next")'); await page.waitForTimeout(200);
const second = await page.inputValue('[data-f="r.0.n"]');
check(first && second && first !== second, 'Save and next opens the next medicine (' + first + ' → ' + second + ')');
check(await page.evaluate((n) => { const e = window.raydar.S.log.find((x) => x.n === n); return e && e.dose === '500 mg' && e.fr === 'Twice daily'; }, first), 'the details are saved on ' + first);
await page.click('#rail button:has-text("Cancel")'); await page.waitForTimeout(150);
check(await page.evaluate(() => !window.raydar.S.filling && window.raydar.S.log.length === 7), 'Cancel stops the round and keeps the medicine', await page.evaluate(() => [window.raydar.S.filling, window.raydar.S.log.length]));

// 14. Medications search shows only the medicine typed and its status (no list rows matched on headings)
await page.evaluate(() => { const R = window.raydar; R.S.proS = 'OLX MEL'; R.S.rmode = 'one'; R.commit(); }); await page.waitForTimeout(150);
for (const q of ['m', 'me', 'met', 'metformin']) {
  await sb.fill(q); await page.waitForTimeout(150);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#rail .row')].filter((r) => /Minoxidil/.test(r.textContent)).length);
  check(rows === 0, 'OLX MEL, typing "' + q + '": no Minoxidil rows', rows);
}
check(/Metformin/.test(await page.locator('.lbox').innerText()), 'typing "metformin": just Metformin and its status');

check(!errors.length, 'no page errors', errors);
await browser.close();
await srv.close();
console.log(failed ? '\n' + failed + ' failed' : '\nMedicine name suggestions work as expected.');
process.exit(failed ? 1 : 0);
