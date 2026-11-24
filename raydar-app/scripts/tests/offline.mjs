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
const ok = name === 'p654321_0000-QuickCheck-Callback_Unsure_on_dates.pdf' && pid === 'p654321_0000' && !errors.length;
console.log((ok ? 'ok   ' : 'FAIL ') + path.basename(file) + ' offline: saved ' + name + ', reopened PID ' + pid + (errors.length ? ' · ' + errors[0] : ''));
process.exit(ok ? 0 : 1);
