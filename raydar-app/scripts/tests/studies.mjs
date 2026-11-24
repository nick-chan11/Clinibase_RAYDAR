// Every study, answered start to finish by keyboard (key 1, Enter for multi, typed answers), as a woman and as a man.
// Passes when every study reaches Finish with no page errors.  npm run test:studies
import { playwright, startRaydar, openPage } from './lib.mjs';

const { chromium } = playwright();
const srv = await startRaydar();
const browser = await chromium.launch();
let failed = 0;
for (const sex of ['f', 'm']) {
  const { page, errors } = await openPage(browser, srv.url);
  const codes = await page.evaluate(() => window.raydar.ranked(true).map((x) => x.s.c).sort());
  for (const code of codes) {
    errors.length = 0;
    await page.evaluate(([code, sex]) => {
      const R = window.raydar; R.act('new'); const S = R.S;
      S.pid = 'p123456_0000'; S.dob = '1990-06-15'; S.match = true; R.act('confirm');
      S.sex = sex; S.wt = '75'; S.ht = '172'; if (sex === 'f') S.preg = 'n'; R.act('norest'); S.meds = 'n'; S.smoke = 'n';
      R.act('start:' + code);
      const s = R.S.study;
      if (s.cohorts) { const c = s.cohorts.find((c) => R.cStat(c) === 'open'); if (c) R.act('avail:' + s.c + ':' + c.id); R.act('dok'); }
      R.act('read'); R.act('startq'); R.commit();
    }, [code, sex]);
    await page.waitForTimeout(120);
    let last = '', stuck = 0;
    for (let i = 0; i < 400; i++) {
      const st = await page.evaluate(() => { const R = window.raydar, { q } = R.curQ(); return { done: R.psDone(), id: q && q.id, kind: q && q.kind, stage: R.S.stage }; });
      if (st.done || st.stage !== 'ps') break;
      if (st.id === last) { if (++stuck > 3) break; } else stuck = 0;
      last = st.id;
      if (st.kind === 'multi') await page.keyboard.press('Enter');
      else if (st.kind === 'text') { await page.keyboard.press('1'); await page.keyboard.type('70'); await page.keyboard.press('Enter'); await page.evaluate(() => document.activeElement && document.activeElement.blur()); }
      else await page.keyboard.press('1');
      await page.waitForTimeout(20);
    }
    const done = await page.evaluate(() => window.raydar.psDone());
    if (done) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
    const stage = await page.evaluate(() => window.raydar.S.stage);
    const ok = done && stage === 'finish' && !errors.length;
    if (!ok) failed++;
    console.log((ok ? 'ok   ' : 'FAIL ') + (sex === 'f' ? 'F ' : 'M ') + code.padEnd(26) + (ok ? '' : ' stuck at ' + last + (errors.length ? ' · ' + errors[0] : '')));
  }
  await page.close();
}
await browser.close();
await srv.close();
console.log(failed ? '\n' + failed + ' failed' : '\nAll studies reach Finish, as a woman and as a man.');
process.exit(failed ? 1 : 0);
