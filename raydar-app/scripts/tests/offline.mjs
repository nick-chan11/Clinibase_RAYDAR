// Opens the built single file (../RAYDAR_<version>.html) with the network switched off, saves a callback PDF and
// reopens it. Proves the file recruiters get works with no internet.  npm run build:single && npm run test:offline
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { playwright, APP, openPage } from './lib.mjs';

const ver = JSON.parse(readFileSync(path.join(APP, 'package.json'), 'utf8')).version.split('.').slice(0, 2).join('.');
const file = path.resolve(APP, '..', 'RAYDAR_' + ver + '.html');
const OUT = mkdtempSync(path.join(tmpdir(), 'raydar-offline-'));
const { chromium } = playwright();
const browser = await chromium.launch();
const { page, errors } = await openPage(browser, null);
await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
await page.goto(pathToFileURL(file).href); await page.waitForTimeout(900);
// 2.11: Travel works in the built file too, next to a studies bundle published before 2.11 (no addresses in it)
await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
await page.fill('#f-pc', '3150'); await page.click('.tv-btn'); await page.waitForTimeout(200);
const tv = await page.evaluate(() => { const p = document.querySelector('.tv-pop'); if (!p) return { rows: 0 }; const r = p.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + 20); return { rows: p.querySelectorAll('.tv-row').length, onTop: !!(top && p.contains(top)) }; });
await page.locator('.tv-pop button:has-text("By car")').first().click(); await page.waitForTimeout(100);
const opened = await page.evaluate(() => window.__opened);
const tvOk = tv.rows === 3 && tv.onTop && opened.length === 1 && /google\.com\/maps\/dir\/.*origin=3150/.test(opened[0]);
console.log((tvOk ? 'ok   ' : 'FAIL ') + 'Travel in the built file: ' + tv.rows + ' places, ' + (tv.onTop ? 'on top' : 'HIDDEN') + ', By car opens ' + (opened[0] || 'nothing'));
await page.keyboard.press('Escape');
await page.fill('#f-pid', 'p654321_0000'); await page.fill('#f-dob', '1990-06-15'); await page.check('input[data-f=match]'); await page.keyboard.press('Enter');
await page.waitForTimeout(200);
await page.locator('button', { hasText: 'Finish call' }).first().click(); await page.waitForTimeout(300);
await page.click('button[role=radio]:has-text("Save for callback")');
await page.click('button[role=radio]:has-text("Unsure on dates")');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Save PDF")')]);
const name = dl.suggestedFilename(); await dl.saveAs(path.join(OUT, name));
await page.click('button:has-text("Start next call")'); await page.waitForTimeout(300);
await page.setInputFiles('input[type=file]', path.join(OUT, name)); await page.waitForTimeout(800);
const pid = await page.inputValue('#f-pid');
await browser.close();
const ok = tvOk && name === 'p654321_0000-QuickCheck-Callback_Unsure_on_dates.pdf' && pid === 'p654321_0000' && !errors.length;
console.log((ok ? 'ok   ' : 'FAIL ') + path.basename(file) + ' offline: saved ' + name + ', reopened PID ' + pid + (errors.length ? ' · ' + errors[0] : ''));
process.exit(ok ? 0 : 1);
