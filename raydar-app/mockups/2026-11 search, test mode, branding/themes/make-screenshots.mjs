import fs from 'node:fs';
import { playwright, startRaydar } from '/home/user/Clinibase_RAYDAR/raydar-app/scripts/tests/lib.mjs';
const SP = '<scratchpad>';
const svg = fs.readFileSync('/home/user/Clinibase_RAYDAR/Clinibase Branding/Logos Red Bilby/Edited Clinibase logo/CLINIBASE LOGO BW.svg', 'utf8');
// the official colours: CB circle in Clinibase Blue with a white motif; letters in the text colour
const logo = (ink) => svg.replace(/<\?xml[^>]*>|<!--[^>]*-->/g, '')
  .replace('style="fill:none;fill-opacity:1;fill-rule:evenodd;stroke:none"', 'style="fill:#00aff5;fill-rule:evenodd;stroke:none"')
  .replace(/style="fill:#000000;fill-opacity:1;fill-rule:evenodd;stroke:#000000;([^"]*)"/, 'style="fill:#ffffff;fill-rule:evenodd;stroke:#ffffff;$1"')
  .replace(/fill:#000000/g, 'fill:' + ink)
  .replace(/width="1549.72"\s*height="301.46667"/, 'height="26" width="134" aria-label="Clinibase"');
const css = (f) => fs.readFileSync(SP + '/themes/' + f, 'utf8');
const { chromium } = playwright(); const srv = await startRaydar();
const b = await chromium.launch();
async function shot(name, opt, dark, stage, tm) {
  const p = await b.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 });
  await p.route(/cdn\.jsdelivr\.net\/npm\/@tabler\/icons-webfont@3\.19\.0\/(.*)/, (r) => { const f = '<scratchpad>/tabler/package/' + r.request().url().split('@3.19.0/')[1].split('?')[0]; r.fulfill({ path: f }); });
  await p.goto(srv.url); await p.waitForTimeout(1200);
  await p.evaluate(([dark, stage]) => {
    const R = window.raydar; const S = R.S;
    if (dark) R.act('theme');
    if (stage === 'q') {
      S.pid = 'p123456_0000'; S.dob = '1970-06-15'; S.match = true; R.act('confirm');
      S.sex = 'f'; S.wt = '75'; S.ht = '172'; S.preg = 'n'; R.act('norest'); S.meds = 'n'; S.smoke = 'n';
      const c = R.ranked(true).map((x) => x.s.c).find((c) => /D7260/.test(c));
      R.act('start:' + c); const s = R.S.study;
      if (s.cohorts) { const co = s.cohorts.find((c) => R.cStat(c) === 'open'); if (co) R.act('avail:' + s.c + ':' + co.id); R.act('dok'); }
      R.act('read'); R.act('startq');
    }
    R.commit();
  }, [dark, stage]);
  if (opt) {
    await p.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600;700&family=Montserrat:wght@600;700&display=swap' });
    await p.addStyleTag({ content: css('base-light.css') + css('base-dark.css') + css('opt' + opt + '.css') });
    const ink = opt === 'B' ? '#ffffff' : dark ? '#eaf1f8' : '#1b2a3f';
    await p.evaluate(([html]) => {
      const br = document.querySelector('#rd .bar .brand'); if (!br) return;
      const w = document.createElement('span'); w.innerHTML = html; w.style.cssText = 'display:inline-flex;align-items:center;margin-right:14px;padding-right:14px;border-right:1px solid var(--border-strong);vertical-align:middle';
      br.style.display = 'inline-flex'; br.style.alignItems = 'center'; br.style.gap = '.3em'; br.prepend(w);
    }, [logo(ink)]);
  }
  if (tm) await p.evaluate(([tm]) => {
    const pink = '#dd0881';
    const tb = document.querySelector('.trial-banner');
    if (tm === 'entry') {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm identity'));
      const card = btn.closest('.card') || btn.parentElement.parentElement;
      const d = document.createElement('div');
      d.style.cssText = 'margin-top:14px;padding-top:12px;border-top:.5px solid var(--border);display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-secondary)';
      d.innerHTML = '<span><b style="color:var(--text-primary);font-weight:500">Just looking around?</b> Explore any study without a participant: no identity, date or study-info checks.</span><span style="flex:1"></span><button class="pill" style="white-space:nowrap;border-color:' + pink + ';color:#a10663"><i class="ti ti-ghost"></i> Explore in test mode</button>';
      card.appendChild(d); return;
    }
    tb.innerHTML = '<b style="font-weight:600;letter-spacing:.04em">TEST MODE</b> &nbsp;For exploring studies and testing RAYDAR. Checks are switched off and nothing here is a real pre-screen. <b style="font-weight:600">Don’t enter a real participant’s details.</b> Switch back to normal mode before a real call. <button class="pill" style="margin-left:10px;background:#fff;border-color:' + pink + ';color:#a10663;font-size:12px">Back to normal mode</button>';
    tb.style.cssText = 'background:#fce7f3;border:1px solid ' + pink + ';color:#7a0447;position:sticky;top:0;z-index:50;border-radius:8px;padding:8px 12px;font-size:13px;margin:0 3rem 8px';
    const pid = [...document.querySelectorAll('#rd .bar .pill')].find((x) => /p123456/.test(x.textContent));
    if (pid) { pid.innerHTML = '<i class="ti ti-ghost"></i> Test mode · no participant'; pid.style.cssText = 'background:#fce7f3;color:#a10663;border-color:' + pink; }
    // steps: every step open
    { const row = document.querySelector('.stepsrow'); const tw = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); const hits = []; while (tw.nextNode()) if (/^\s*(Identity|Quick check)\s*$/.test(tw.currentNode.nodeValue)) hits.push(tw.currentNode); for (const n of hits) { const sk = document.createElement('span'); sk.textContent = ' · skipped'; sk.style.cssText = 'color:#a10663;font-size:11px'; n.after(sk); } }
    if (tm === 'T2') { document.body.style.boxShadow = 'inset 0 0 0 4px ' + pink; document.body.style.minHeight = '100vh'; }
    // a "show hidden questions" switch by the section tabs
    const tabs = [...document.querySelectorAll('button')].find((b) => /^Call script/.test(b.textContent.trim()));
    if (tabs) { const w = document.createElement('label'); w.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#a10663;margin-left:8px'; w.innerHTML = '<input type="checkbox" checked style="accent-color:' + pink + '"> Show questions hidden by earlier answers'; tabs.parentElement.appendChild(w); }
  }, [tm]);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
  await p.screenshot({ path: SP + '/mock/' + name + '.jpg', type: 'jpeg', quality: 82 });
  await p.close();
}
await shot('tm-entry', null, false, 'id', 'entry');
await shot('tm-T1', null, false, 'q', 'T1');
await shot('tm-T2', null, false, 'q', 'T2');
if (process.argv[2] === 'tm') { await b.close(); await srv.close(); process.exit(0); }
for (const dark of [false, true]) {
  const m = dark ? 'dark' : 'light';
  await shot('now-' + m, null, dark, 'q');
  for (const o of ['A', 'B', 'C']) await shot(o + '-' + m, o, dark, 'q');
}
await b.close(); await srv.close();
