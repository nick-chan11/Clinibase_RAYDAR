// The header and scrolling (RAYDAR 2.11): slimming the header never changes the page's height, so the page doesn't
// jump; a page with little to scroll keeps the full header.  npm run test:scroll
import { playwright, startRaydar, openPage } from './lib.mjs';

const { chromium } = playwright();
const srv = await startRaydar();
const browser = await chromium.launch();
let failed = 0;
const check = (ok, what, got) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + what + (ok ? '' : ' · got ' + JSON.stringify(got))); };

for (const mode of ['one', 'list']) {
  const { page, errors } = await openPage(browser, srv.url, { viewport: { width: 1440, height: 900 } });
  await page.evaluate((mode) => { const R = window.raydar, S = R.S;
    S.pid = 'p123456_0000'; S.dob = '1970-06-15'; S.match = true; R.act('confirm');
    S.sex = 'f'; S.wt = '75'; S.ht = '172'; S.preg = 'n'; R.act('norest'); S.meds = 'n'; S.smoke = 'n';
    R.act('start:' + R.ranked(true).map((x) => x.s.c).find((c) => /D7260/.test(c))); const s = R.S.study;
    if (s.cohorts) { const c = s.cohorts.find((c) => R.cStat(c) === 'open'); if (c) R.act('avail:' + s.c + ':' + c.id); R.act('dok'); }
    R.act('read'); R.act('startq'); if (mode === 'list') R.act('mode:list'); R.commit(); }, mode);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  // record every scroll movement; the test's own wheel steps are 60 px, anything else is the page jumping
  await page.evaluate(() => { window.__moves = []; window.__h = new Set(); let last = scrollY;
    addEventListener('scroll', () => { window.__moves.push(Math.round(scrollY - last)); last = scrollY; window.__h.add(document.documentElement.scrollHeight); }); });
  const room = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i < Math.ceil(room / 60) + 4; i++) { await page.mouse.wheel(0, 60); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  const slimAtBottom = await page.evaluate(() => document.getElementById('rd').classList.contains('slim'));
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, i % 2 ? 60 : -60); await page.waitForTimeout(120); }
  for (let i = 0; i < Math.ceil(room / 60) + 4; i++) { await page.mouse.wheel(0, -60); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ jumps: window.__moves.filter((d) => Math.abs(d) > 61), heights: [...window.__h], slim: document.getElementById('rd').classList.contains('slim') }));
  check(!r.jumps.length, mode + ' (' + room + ' px to scroll): no jumps while scrolling down, at the bottom and back up', r.jumps);
  check(r.heights.length === 1, mode + ': the page keeps the same height whether the header is full or slim', r.heights);
  check(room > 260 ? slimAtBottom : !slimAtBottom, mode + ': ' + (room > 260 ? 'a long page slims the header' : 'a short page keeps the full header'), { room, slimAtBottom });
  check(!r.slim, mode + ': the full header is back at the top', r.slim);
  check(!errors.length, mode + ': no page errors', errors);
  await page.close();
}
await browser.close();
await srv.close();
console.log(failed ? '\n' + failed + ' failed' : '\nThe header and scrolling work as expected.');
process.exit(failed ? 1 : 0);
