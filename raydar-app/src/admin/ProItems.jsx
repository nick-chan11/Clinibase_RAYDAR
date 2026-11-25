/* Prohibited lists in the study admin (Quick check and lists tab).
   Each medication bullet from the eSource becomes a structured item: the medicines and drug groups it covers, the
   outcome, the time window, the forms it applies to and any allowed doses. RAYDAR pre-fills it from the bullet's
   words; TST confirms or corrects it. Saved in the study's settings as proItems[key]. Publishing asks for every
   item to be confirmed (or "publish anyway"). Conditions stay a "possible match" on their words. */
import { useState } from 'react';
import { W, edit } from './ws.js';
import { TextBox } from './TextBox.jsx';
import { itemKey, itemFor, prefill, windowWords, itemMatches, checkMed, checkHx, hxWords, UNIT_WORDS } from '../medicines/items.js';
import { suggest, groupName, dictionary, cap, routeWords, dictVersion } from '../medicines/dict.js';

const Ic = ({ n }) => <i className={'ti ' + n} aria-hidden="true" />;
const FORMS = [['', 'Any form'], ['ios', 'Taken by mouth or injected (systemic)'], ['o', 'By mouth only'], ['t', 'On the skin only'], ['n', 'Nasal only']];

/** Medication items still to confirm (not counting notes marked "not a prohibited list") */
export function unconfirmed(s, b) {
  const set = (b && b.settings) || {}, items = set.proItems || {};
  return ((s.pro && s.pro.med) || []).filter((p) => !(items[itemKey(p)] && items[itemKey(p)].conf));
}

export function Prohibited({ b, s }) {
  const [kind, setKind] = useState('med'), [sel, setSel] = useState(null);
  const set = b.settings || {};
  const all = (s.proAll || {})[kind] || [];
  const skip = set.proSkip || [];
  const srcs = [...new Set(all.map((p) => p.src))];
  // items read from a question are labelled with the question; the rest with the note they came from
  const title = (src) => { const n = ((s.proNotes || {})[kind] || []).find((x) => x.name === src); if (n) return n.title; const q = all.find((p) => p.src === src && p.from === 'q'); return q ? 'From the question' : src; };
  const shown = all.filter((p) => !skip.includes(p.src));
  const left = kind === 'med' ? unconfirmed(s, b).length : 0;
  const cur = shown.find((p) => itemKey(p) === sel) || (kind === 'med' ? shown.find((p) => !((set.proItems || {})[itemKey(p)] || {}).conf) : null) || shown[0];
  const v = dictVersion();
  return (
    <section className="ad-card ad-pro-card">
      <h2>Prohibited lists</h2>
      <p className="ad-mut ad-small">Read from the eSource's bulleted exclusion notes. For each medication item, check what RAYDAR thinks it covers, then confirm it. Recruiters see a brand name (Lipitor), an ingredient (atorvastatin) or a misspelling matched to the right item. Medicines dictionary: AMT {v.amt || '?'}, PBS schedule {v.pbs || '?'}.</p>
      <div className="ad-row" style={{ marginBottom: 8 }}>
        <span className="ad-seg"><button className={kind === 'med' ? 'on' : ''} onClick={() => setKind('med')}>Medications ({((s.proAll || {}).med || []).length})</button><button className={kind === 'hx' ? 'on' : ''} onClick={() => setKind('hx')}>Conditions ({((s.proAll || {}).hx || []).length})</button></span>
        {kind === 'med' && shown.length ? <span className={left ? 'ad-err' : 'ad-ok'}>{left ? left + ' of ' + shown.length + ' still to confirm' : 'All ' + shown.length + ' confirmed'}</span> : null}
      </div>
      {!srcs.length ? <p className="ad-mut">None found.</p> : kind === 'hx' ? <Conditions b={b} s={s} srcs={srcs} all={all} skip={skip} title={title} /> : (
        <div className="ad-pro2">
          <div className="ad-pro2-list">
            {srcs.map((src) => (
              <div key={src} className="ad-pro2-src">
                <div className="ad-small ad-mut" title={String(title(src))}>{String(title(src)).slice(0, 60)}</div>
                <label className="ad-check ad-small"><input type="checkbox" checked={skip.includes(src)} onChange={(e) => edit((x) => { x.settings = x.settings || {}; const l = new Set(x.settings.proSkip || []); if (e.target.checked) l.add(src); else l.delete(src); x.settings.proSkip = [...l]; if (!x.settings.proSkip.length) delete x.settings.proSkip; })} /> Not a prohibited list</label>
                {skip.includes(src) ? null : all.filter((p) => p.src === src).map((p) => {
                  const k = itemKey(p), it = itemFor(s, p);
                  return (
                    <button key={k} className={'ad-pro2-i' + (cur && itemKey(cur) === k ? ' on' : '')} onClick={() => setSel(k)}>
                      <span>{p.n.slice(0, 70)}</span>
                      <span className={'ad-tag ' + (it.conf ? 'ok' : 'warn')}>{it.conf ? 'Done' : it.ask ? 'Ask only?' : 'Check'}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {cur ? <ItemEditor key={itemKey(cur)} b={b} s={s} p={cur} /> : <p className="ad-mut">Every list here is marked "not a prohibited list".</p>}
        </div>
      )}
    </section>
  );
}

function ItemEditor({ b, s, p }) {
  const key = itemKey(p);
  const it = itemFor(s, p), pre = prefill(p);
  const [add, setAdd] = useState(''), [test, setTest] = useState(''), [exI, setExI] = useState(''), [exMg, setExMg] = useState('');
  // every change saves the whole item, marked not confirmed until the button is pressed again
  const save = (fn) => edit((x) => {
    x.settings = x.settings || {};
    x.settings.proItems = { ...(x.settings.proItems || {}) };
    const cur = JSON.parse(JSON.stringify({ cov: it.cov, o: it.o, win: it.win, rt: it.rt, ex: it.ex || [], ask: !!it.ask }));
    fn(cur);
    cur.conf = false;
    x.settings.proItems[key] = cur;
  }, 'typing');
  const confirm = (yes) => edit((x) => {
    x.settings = x.settings || {};
    x.settings.proItems = { ...(x.settings.proItems || {}) };
    const cur = JSON.parse(JSON.stringify({ cov: it.cov, o: it.o, win: it.win, rt: it.rt, ex: it.ex || [], ask: !!it.ask }));
    x.settings.proItems[key] = yes ? { ...cur, conf: true, by: W.name || '', at: new Date().toISOString().slice(0, 10) } : { ...cur, conf: false };
  });
  const m = itemMatches(it);
  const groupHits = add.trim().length >= 3 ? Object.entries(dictionary().groups).filter(([c, n]) => (c.length >= 4 || c.startsWith('x-')) && n.toLowerCase().includes(add.trim().toLowerCase())).slice(0, 5) : [];
  const medHits = add.trim().length >= 2 ? suggest(add, 5).filter((x) => x.ings.length === 1) : [];
  const t = test.trim() ? checkMed({ t: 'med', n: test, dose: test, route: test }, { ...s, pro: { med: [p] }, proItems: { [key]: it } }) : null;
  const win = it.win || { k: 'none' };
  return (
    <div className="ad-pro2-ed">
      <div className="ad-row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{p.n}</b>
        <span className={'ad-tag ' + (it.conf ? 'ok' : 'acc')}>{it.conf ? 'Confirmed' + (it.by ? ' by ' + it.by : '') + (it.at ? ', ' + it.at : '') : 'Pre-filled by RAYDAR'}</span>
      </div>
      <div className="ad-quote ad-small"><span className="ad-mut">From the eSource:</span> <i>"{p.n}"</i>{p.w ? <> · under <i>"{p.w}"</i></> : null}</div>

      <label className="ad-check" style={{ marginTop: 8 }}><input type="checkbox" checked={!!it.ask} onChange={(e) => save((c) => { c.ask = e.target.checked; })} /> Not something RAYDAR can match by medicine (a treatment, device, dose change or study drug): recruiters ask about it</label>

      {it.ask ? (
        <label className="ad-field">Words that flag it in the med log (optional)
          <TextBox value={((b.settings || {}).proKeys || {})[p.n] ? b.settings.proKeys[p.n].join(', ') : (p.k || []).join(', ')} placeholder="words, comma separated" onChange={(v2) => edit((x) => { x.settings = x.settings || {}; x.settings.proKeys = { ...(x.settings.proKeys || {}), [p.n]: v2.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) }; })} />
        </label>
      ) : (
        <>
          <div className="ad-fl">Covers</div>
          <div className="ad-chips" style={{ marginTop: 0 }}>
            {(it.cov.g || []).map((g) => <span key={g} className="ad-chip">Group: {groupName(g)} <span className="ad-mut">{g.startsWith('x-') ? 'RAYDAR' : g}</span> <button className="ad-x" aria-label={'Remove ' + groupName(g)} onClick={() => save((c) => { c.cov.g = c.cov.g.filter((x) => x !== g); })}><Ic n="ti-x" /></button></span>)}
            {(it.cov.i || []).map((i) => <span key={i} className="ad-chip">{i} <button className="ad-x" aria-label={'Remove ' + i} onClick={() => save((c) => { c.cov.i = c.cov.i.filter((x) => x !== i); })}><Ic n="ti-x" /></button></span>)}
            {!(it.cov.g || []).length && !(it.cov.i || []).length ? <span className="ad-err ad-small">Nothing yet: add the medicines or groups this item covers, or tick the box above</span> : null}
          </div>
          {pre.sug && pre.sug.filter((g) => !(it.cov.g || []).includes(g)).length ? (
            <div className="ad-small" style={{ marginTop: 4 }}>The bullet also names a group. Only add it if the whole group is prohibited, not just the medicines listed: {pre.sug.filter((g) => !(it.cov.g || []).includes(g)).map((g) => <button key={g} className="ad-btn sm ghost" onClick={() => save((c) => { c.cov.g = [...(c.cov.g || []), g]; })}><Ic n="ti-plus" /> {groupName(g)}</button>)}</div>
          ) : null}
          {pre.guess && pre.guess.length ? <div className="ad-msg warn ad-small" style={{ marginTop: 6 }}>Read by a close spelling, check: {pre.guess.join('; ')}</div> : null}
          <div className="ad-sugg-wrap">
            <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add a medicine or group, e.g. sertraline or SSRI" aria-label="Add a medicine or group" />
            {groupHits.length || medHits.length ? (
              <div className="ad-sugg-list">
                {groupHits.map(([c, n]) => <button key={c} onClick={() => { save((x) => { x.cov.g = [...new Set([...(x.cov.g || []), c])]; }); setAdd(''); }}>Group: <b>{n}</b> <span className="ad-mut">{c.startsWith('x-') ? 'RAYDAR' : c}</span></button>)}
                {medHits.map((x) => <button key={x.name} onClick={() => { save((c) => { c.cov.i = [...new Set([...(c.cov.i || []), x.ings[0]])]; }); setAdd(''); }}><b>{x.ings[0]}</b>{x.type === 'b' ? <span className="ad-mut"> (from {x.label})</span> : null}</button>)}
              </div>
            ) : null}
          </div>
          <div className="ad-small ad-mut" style={{ marginTop: 4 }}>
            {m.ings.length ? <>Matches {m.ings.length} ingredient{m.ings.length > 1 ? 's' : ''} and {m.brands.length} brand{m.brands.length === 1 ? '' : 's'}: {m.brands.slice(0, 8).map(cap).join(', ')}{m.brands.length > 8 ? '…' : ''}</> : 'Matches no medicines yet.'}
            {m.ings.length > 1 ? <details><summary>Show the ingredients</summary>{m.ings.join(', ')}</details> : null}
          </div>

          <div className="ad-pro2-grid">
            <div>
              <div className="ad-fl">Outcome</div>
              <span className="ad-seg"><button className={it.o === 'x' ? 'on' : ''} onClick={() => save((c) => { c.o = 'x'; })}>Exclude</button><button className={it.o === 'd' ? 'on' : ''} onClick={() => save((c) => { c.o = 'd'; })}>Doctor check</button></span>
            </div>
            <div>
              <div className="ad-fl">Time window</div>
              <span className="ad-seg">
                {[['cur', 'Current'], ['in', 'Within'], ['ever', 'Ever'], ['none', 'Not stated']].map(([k2, l]) => <button key={k2} className={win.k === k2 ? 'on' : ''} onClick={() => save((c) => { c.win = k2 === 'in' ? { k: 'in', n: win.n || 30, u: win.u || 'd' } : { k: k2 }; })}>{l}</button>)}
              </span>
              {win.k === 'in' ? (
                <span className="ad-row" style={{ marginTop: 6 }}>
                  <input type="number" min="1" style={{ width: 70 }} value={win.n} aria-label="How many" onChange={(e) => save((c) => { c.win = { ...c.win, n: Math.max(1, +e.target.value || 1) }; })} />
                  <select value={win.u} aria-label="Days, weeks, months or years" onChange={(e) => save((c) => { c.win = { ...c.win, u: e.target.value }; })}>{Object.entries(UNIT_WORDS).map(([u, w]) => <option key={u} value={u}>{w}</option>)}</select>
                  <span className="ad-mut ad-small">before screening</span>
                </span>
              ) : null}
            </div>
            <div>
              <div className="ad-fl">Forms it applies to</div>
              <select value={it.rt || ''} onChange={(e) => save((c) => { c.rt = e.target.value; })}>{FORMS.map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}</select>
              {it.rt ? <div className="ad-mut ad-small">Other forms ({routeWords('oihnetvs'.replace(new RegExp('[' + it.rt + ']', 'g'), ''))}) show as a doctor check.</div> : null}
            </div>
          </div>

          <div className="ad-fl">Allowed doses</div>
          {(it.ex || []).map((ex, i) => <div key={i} className="ad-row ad-small">{ex.i} up to {ex.mg} mg a day: allowed <button className="ad-x" aria-label="Remove" onClick={() => save((c) => { c.ex.splice(i, 1); })}><Ic n="ti-x" /></button></div>)}
          <div className="ad-row">
            <select value={exI} onChange={(e) => setExI(e.target.value)} aria-label="Ingredient"><option value="">Ingredient…</option>{m.ings.slice(0, 200).map((i) => <option key={i}>{i}</option>)}</select>
            <input type="number" min="0" style={{ width: 80 }} value={exMg} onChange={(e) => setExMg(e.target.value)} placeholder="mg/day" aria-label="Most mg a day" />
            <button className="ad-btn sm" disabled={!exI || !(+exMg > 0)} onClick={() => { save((c) => { c.ex = [...(c.ex || []), { i: exI, mg: +exMg }]; }); setExI(''); setExMg(''); }}><Ic n="ti-plus" /> Add an allowed dose</button>
          </div>
        </>
      )}

      <div className="ad-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        <label className="ad-row ad-small" style={{ flex: 1 }}>Test it <input value={test} onChange={(e) => setTest(e.target.value)} placeholder="e.g. Lipitor 40 mg" style={{ maxWidth: 220 }} />
          {test.trim() ? <span className={!t ? 'ad-ok' : t.o === 'x' ? 'ad-err' : t.o === 'd' ? 'ad-warn' : 'ad-ok'}>{!t ? 'No match on this item' : (t.o === 'x' ? 'Excluded' : t.o === 'd' ? 'Doctor check' : 'OK') + (t.why ? ': ' + t.why : '')}</span> : null}
        </label>
        {it.conf ? <button className="ad-btn sm ghost" onClick={() => confirm(false)}>Edit again</button> : <button className="ad-btn pri" onClick={() => confirm(true)}><Ic n="ti-check" /> Confirm item</button>}
      </div>
      <p className="ad-mut ad-small">{windowWords(win)}{it.rt ? ' · ' + FORMS.find((f) => f[0] === it.rt)[1].toLowerCase() : ''} · {it.o === 'x' ? 'excludes' : 'doctor check'}</p>
    </div>
  );
}

function Conditions({ b, s, srcs, all, skip, title }) {
  const set = b.settings || {};
  const [test, setTest] = useState('');
  const hit = test.trim() ? checkHx({ t: 'hx', n: test }, s) : null;
  return (
    <>
      <p className="ad-mut ad-small">A logged condition that shares a word with an item shows as "Possible match, check". RAYDAR never decides a diagnosis. Adjust the words if an item flags the wrong things.</p>
      {srcs.map((src) => (
        <div key={src} className="ad-prosrc">
          <div className="ad-row"><span className="ad-small"><b>From:</b> {String(title(src)).slice(0, 80)}</span><span style={{ flex: 1 }} />
            <label className="ad-check ad-small"><input type="checkbox" checked={skip.includes(src)} onChange={(e) => edit((x) => { x.settings = x.settings || {}; const l = new Set(x.settings.proSkip || []); if (e.target.checked) l.add(src); else l.delete(src); x.settings.proSkip = [...l]; if (!x.settings.proSkip.length) delete x.settings.proSkip; })} /> Not a prohibited list</label></div>
          {skip.includes(src) ? null : all.filter((p) => p.src === src).slice(0, 60).map((p, i) => (
            <div key={i} className="ad-proitem">
              <span className={p.o === 'x' ? 'bad' : 'warn'}>{p.n.slice(0, 90)}</span>
              <label className="ad-small">Words <TextBox value={((set.proKeys || {})[p.n] || hxWords(p)).join(', ')} placeholder="words, comma separated" onChange={(v) => edit((x) => { x.settings = x.settings || {}; x.settings.proKeys = { ...(x.settings.proKeys || {}), [p.n]: v.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) }; })} /></label>
            </div>
          ))}
        </div>
      ))}
      <label className="ad-field">Try a condition <input value={test} onChange={(e) => setTest(e.target.value)} placeholder="e.g. hypothyroidism" />
        {test.trim() ? <span className={hit ? 'ad-warn' : 'ad-ok'}>{hit ? 'Possible match: "' + hit.n.slice(0, 60) + '"' : 'No match on this study\'s list'}</span> : null}
      </label>
    </>
  );
}
