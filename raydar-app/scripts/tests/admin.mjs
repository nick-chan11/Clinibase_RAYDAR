// The study admin, end to end: set up a studies folder, drag a question into V175-001, give an answer an outcome,
// publish with a second check, and check the eSource file, the history copy and the recruiter note in the folder.
// Then preview a draft as a recruiter and come back. The "Dropbox folder" is the browser's private file system,
// offered by a stand-in folder picker, so nothing on disk is touched.  npm run test:admin
import { playwright, startRaydar, openPage } from './lib.mjs';

const { chromium } = playwright();
const srv = await startRaydar();
const browser = await chromium.launch();
const { page: p, errors } = await openPage(browser, null, { viewport: { width: 1440, height: 1000 } });
await p.addInitScript(() => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('RAYDAR studies', { create: true }); });
await p.goto(srv.url); await p.waitForTimeout(900);
let failed = 0;
const check = (ok, what) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + what); };

await p.evaluate(() => window.raydar.act('admin:open')); await p.waitForTimeout(700);
check(await p.locator('.ad-badge').count() === 1, 'the study admin opens');
await p.fill('.ad-namebox input', 'Test Admin'); await p.click('.ad-namebox button');
await p.click('button.ad-navi:has-text("Studies folder")');
await p.click('button:has-text("Connect the studies folder")'); await p.waitForTimeout(1200);
await p.click('button:has-text("Fill the folder with the built-in studies")'); await p.waitForTimeout(5000);
check(/set up/.test(await p.locator('.ad-msg').first().innerText()), 'an empty folder is filled with the built-in studies');

await p.click('button.ad-navi:has-text("Studies")');
await p.fill('.ad-search', 'V175');
await p.locator('.ad-tr', { hasText: 'Emeritus Melbourne' }).locator('button:has-text("Open")').click(); await p.waitForTimeout(400);
await p.locator('.ad-blk', { hasText: 'Yes / No question' }).dragTo(p.locator('.ad-zone').nth(1)); await p.waitForTimeout(400);
check(await p.locator('.ad-card2.on').count() === 1, 'a dragged-in question is added and selected');
await p.fill('.ad-insp textarea.say', 'Have you donated blood in the past 3 months?');
await p.locator('.ad-ans').nth(1).locator('select').selectOption('delay'); await p.waitForTimeout(200);
const chips = await p.locator('.ad-card2.on .ad-chip').allTextContents();
check(chips.some((c) => /delay screening/.test(c)), 'changing an outcome rewords the answer (' + chips.join(' / ') + ')');

await p.click('.ad-etabs button:has-text("Preview and publish")');
check(/Added/.test(await p.locator('.ad-chg').first().innerText()), '"What changes" lists the new question');
await p.fill('input[placeholder="e.g. your team lead"]', 'Test Lead');
await p.fill('input[placeholder^="e.g. V175"]', 'V175: new blood donation question');
await p.click('button:has-text("Publish V175-001")'); await p.waitForTimeout(3000);
const inFolder = await p.evaluate(async () => {
  const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('RAYDAR studies');
  const j = JSON.parse(await (await (await (await root.getDirectoryHandle('Pre-screening eSource JSONs')).getFileHandle('Emeritus Melbourne - V175-001 - pre-screening.json')).getFile()).text());
  let q = null; const go = (l) => (l || []).forEach((x) => { if (x.title === 'Have you donated blood in the past 3 months?') q = x; if (x.elements) go(x.elements); }); j.pages.forEach((pg) => go(pg.elements));
  const hist = []; for await (const [n] of (await (await root.getDirectoryHandle('_history')).getDirectoryHandle('Emeritus Melbourne - V175-001 - pre-screening')).entries()) hist.push(n);
  const st = JSON.parse(await (await (await root.getFileHandle('RAYDAR study settings.json')).getFile()).text());
  // 2.8: the studies file recruiters read, rewritten by the publish
  let bundle = null;
  try { const sys = await root.getDirectoryHandle('_system'); const t = await (await (await sys.getFileHandle('raydar_studies.js')).getFile()).text(); const v = await (await (await sys.getFileHandle('raydar_studies_version.js')).getFile()).text(); const w = {}; new Function('window', t + v)(w); bundle = { by: w.RAYDAR_STUDIES.by, same: w.RAYDAR_STUDIES.version === w.RAYDAR_STUDIES_VERSION.version, has: JSON.stringify(w.RAYDAR_STUDIES.data.esource['Emeritus Melbourne - V175-001 - pre-screening.json']).includes('donated blood'), n: Object.keys(w.RAYDAR_STUDIES.data.esource).length }; } catch (e) { bundle = { err: e.message }; }
  return { q, hist, news: st.news || [], bundle };
});
check(inFolder.q && /⚠️/.test(inFolder.q.choices[1].text), 'the published eSource has the question with its ⚠️ marker');
check(inFolder.hist.length === 1 && /by Test Admin/.test(inFolder.hist[0]), 'a history copy is kept (' + inFolder.hist[0] + ')');
check(inFolder.news.some((n) => /blood donation/.test(n.text)), 'the note for recruiters is saved');
check(inFolder.bundle && inFolder.bundle.has && inFolder.bundle.same && inFolder.bundle.by === 'Test Admin', 'the studies file in _system is rewritten with the change (' + JSON.stringify(inFolder.bundle) + ')');
check(await p.evaluate(() => window.raydar.ranked(true).some((x) => x.s.file === 'Emeritus Melbourne - V175-001 - pre-screening.json' && x.s.Q.some((q) => /donated blood/.test(q.t)))), 'RAYDAR uses the published version straight away');

await p.fill('.ad-search', 'SRSD'); await p.locator('.ad-tr', { hasText: 'SRSD' }).locator('button:has-text("Open")').click();
await p.click('.ad-etabs button:has-text("Preview and publish")'); await p.click('button:has-text("Preview as a recruiter")'); await p.waitForTimeout(800);
check(await p.locator('text=Previewing a draft').count() === 1 && (await p.evaluate(() => window.raydar.S.stage)) === 'ps', 'a draft previews in the call screens');
await p.click('button:has-text("Back to the study admin")'); await p.waitForTimeout(500);
check(await p.locator('.ad-badge').count() === 1, 'and comes back to the study admin');

if (errors.length) { failed++; console.log('Page errors: ' + errors.slice(0, 3).join(' | ')); }
await browser.close(); await srv.close();
console.log(failed ? '\n' + failed + ' failed' : '\nThe study admin works end to end.');
process.exit(failed ? 1 : 0);
