/* Quick check rules, prohibited lists and the file check for one study, on its draft. */
import { useState } from 'react';
import { W, edit, notify, draftStudy } from './ws.js';
import { plain } from '../esource/convert.js';
import { CONDS } from '../esource/qcrules.js';
import { CHOICE_TYPES, outcomeKey } from './ops.js';

const Ic = ({ n }) => <i className={'ti ' + n} aria-hidden="true" />;
export const blocking = (s) => (s.issues || []).filter((i) => /never shows|can't be read|no such answer/.test(i.msg));

export function ChecksTab({ b }) {
  const s = draftStudy(b);
  if (s.error) return <p className="ad-msg warn">This study can't be read: {s.error}</p>;
  return (
    <div className="ad-page ad-checks">
      <Rules b={b} s={s} />
      <Prohibited b={b} s={s} />
      <FileCheck b={b} s={s} />
    </div>
  );
}

function Rules({ b, s }) {
  const qc = W.qc;
  const [form, setForm] = useState(null);
  const off = (r) => (qc.ignore || []).some((g) => g.file === b.file && g.question === r.q && (!g.item || g.item === r.item));
  const toggle = (r) => {
    qc.ignore = qc.ignore || [];
    const i = qc.ignore.findIndex((g) => g.file === b.file && g.question === r.q && (!g.item || g.item === r.item));
    if (i >= 0) qc.ignore.splice(i, 1); else qc.ignore.push({ file: b.file, question: r.q, item: r.item });
    W.qcDirty = true; notify();
  };
  // rules switched off don't come back from rulesFor, so list them from the ignore list
  const offRows = (qc.ignore || []).filter((g) => g.file === b.file);
  const items = [['smoke', 'Smokes, vapes or nicotine'], ['meds', 'Regular medications']].concat(CONDS.map((c) => [c[0], c[1]]));
  return (
    <section className="ad-card">
      <h2>Quick check rules</h2>
      <p className="ad-mut ad-small">Read from this study's own questions each time it changes. Switch one off if it's read wrongly; add one when the questions don't spell it out (it needs the eSource wording it comes from).</p>
      {(s.qc || []).map((r, i) => (
        <div key={i} className="ad-rule">
          <b className={r.result === 'no' ? 'bad' : 'warn'}>{r.why}</b>
          <div className="ad-mut ad-small">{r.auto ? 'From "' + r.qt.slice(0, 120) + '" · answer "' + r.a.slice(0, 60) + '"' : 'Extra rule: "' + r.qt.slice(0, 120) + '"'}</div>
          {r.auto ? <button className="ad-link" onClick={() => toggle(r)}>Switch off</button> : <button className="ad-link" onClick={() => { const k = qc.rules.findIndex((x) => x.file === b.file && x.item === r.item && x.when === r.when); if (k >= 0) { qc.rules.splice(k, 1); W.qcDirty = true; notify(); } }}>Remove</button>}
        </div>
      ))}
      {offRows.map((g, i) => <div key={'off' + i} className="ad-rule off">Switched off: question <span className="mono">{g.question}</span>{g.item ? ' (' + g.item + ')' : ''} <button className="ad-link" onClick={() => { qc.ignore.splice(qc.ignore.indexOf(g), 1); W.qcDirty = true; notify(); }}>Switch back on</button></div>)}
      {!(s.qc || []).length && !offRows.length ? <p className="ad-mut">None: only age, BMI, sex and pregnancy apply.</p> : null}
      {(s.qcMissing || []).map((m, i) => (
        <div key={'m' + i} className="ad-msg warn">This study needs <b>{m.name}</b>, which Quick check doesn't ask about ("{m.qt.slice(0, 100)}"). Add it on the Quick check settings page.
          <button className="ad-btn sm" onClick={() => { W.view = 'qc'; notify(); }}>Go there</button></div>
      ))}
      {form ? (
        <div className="ad-ruleform">
          <label className="ad-field sm">If the participant's <select value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}>{items.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="ad-field sm">is <select value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })}><option value="y">Yes</option><option value="n">No</option></select></label>
          <label className="ad-field sm">then <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}><option value="check">Check</option><option value="no">Rule the study out</option></select></label>
          <label className="ad-field">Shown to recruiters as <input value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} placeholder="e.g. Daily prescription medication isn't suitable" /></label>
          <label className="ad-field">The eSource wording it comes from (required) <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Paste the sentence from the study notes" /></label>
          <div className="ad-row"><button className="ad-btn pri" disabled={!form.why.trim() || form.source.trim().length < 10} onClick={() => { (qc.rules = qc.rules || []).push({ file: b.file, ...form }); W.qcDirty = true; setForm(null); }}>Add the rule</button><button className="ad-btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      ) : <button className="ad-btn" onClick={() => setForm({ item: 'meds', when: 'y', result: 'check', why: '', source: '' })}><Ic n="ti-plus" /> Add a rule</button>}
      {W.qcDirty ? <p className="ad-mut ad-small">Quick check changes are published with this study (or from the Quick check settings page).</p> : null}
    </section>
  );
}

function Prohibited({ b, s }) {
  const [kind, setKind] = useState('med'), [test, setTest] = useState('');
  const set = b.settings || {};
  const all = (s.proAll || {})[kind] || [];
  const skip = set.proSkip || [];
  const srcs = [...new Set(all.map((p) => p.src))];
  const title = (src) => { const n = ((s.proNotes || {})[kind] || []).find((x) => x.name === src); return n ? n.title : src; };
  const shown = all.filter((p) => !skip.includes(p.src));
  const t = ' ' + test.toLowerCase() + ' ';
  const hit = test.trim() ? shown.find((p) => { const k = (set.proKeys && set.proKeys[p.n]) || p.k || []; return k.length && k.some((w) => t.includes(w)) && !(p.no || []).some((w) => t.includes(w)); }) : null;
  return (
    <section className="ad-card">
      <h2>Prohibited lists</h2>
      <p className="ad-mut ad-small">Read from the bulleted exclusion notes. Each item lists the words RAYDAR matches in the medication log. Mark a note "not a prohibited list" if it was picked up by mistake.</p>
      <span className="ad-seg"><button className={kind === 'med' ? 'on' : ''} onClick={() => setKind('med')}>Medications ({((s.proAll || {}).med || []).length})</button><button className={kind === 'hx' ? 'on' : ''} onClick={() => setKind('hx')}>Conditions ({((s.proAll || {}).hx || []).length})</button></span>
      {srcs.map((src) => (
        <div key={src} className="ad-prosrc">
          <div className="ad-row"><span className="ad-small"><b>From:</b> {String(title(src)).slice(0, 80)}</span><span style={{ flex: 1 }} />
            <label className="ad-check ad-small"><input type="checkbox" checked={skip.includes(src)} onChange={(e) => edit((x) => { x.settings = x.settings || {}; const l = new Set(x.settings.proSkip || []); if (e.target.checked) l.add(src); else l.delete(src); x.settings.proSkip = [...l]; if (!x.settings.proSkip.length) delete x.settings.proSkip; })} /> Not a prohibited list</label></div>
          {skip.includes(src) ? null : all.filter((p) => p.src === src).slice(0, 40).map((p, i) => {
            const k = (set.proKeys && set.proKeys[p.n]) || p.k || [];
            return (
              <div key={i} className="ad-proitem">
                <span className={p.o === 'x' ? 'bad' : 'warn'}>{p.n.slice(0, 90)}</span>
                <label className="ad-small">Matches <input value={k.join(', ')} placeholder={kind === 'hx' ? 'Conditions are for reference only' : 'words, comma separated'} onChange={(e) => edit((x) => { x.settings = x.settings || {}; x.settings.proKeys = { ...(x.settings.proKeys || {}), [p.n]: e.target.value.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) }; })} /></label>
              </div>
            );
          })}
        </div>
      ))}
      {!srcs.length ? <p className="ad-mut">None found.</p> : null}
      {kind === 'med' ? (
        <label className="ad-field">Try a medication <input value={test} onChange={(e) => setTest(e.target.value)} placeholder="e.g. Ozempic 0.5mg weekly" />
          {test.trim() ? <span className={hit ? 'ad-err' : 'ad-ok'}>{hit ? 'Matches "' + hit.n.slice(0, 60) + '": ' + (hit.o === 'x' ? 'on the prohibited list' : 'doctor check') : 'No match on this study\'s lists'}</span> : null}
        </label>
      ) : null}
    </section>
  );
}

function FileCheck({ b, s }) {
  const must = blocking(s);
  const look = (s.issues || []).filter((i) => !must.includes(i));
  const unmarked = (s.Q || []).filter((q) => q.kind === 'choice' && !q.auto && q.a.some((x) => x[1] === 'i'));
  return (
    <section className="ad-card">
      <h2>File check</h2>
      <p className="ad-mut ad-small">Runs on every change. Red stops publishing unless you choose to publish anyway; amber is worth a look.</p>
      {!must.length && !look.length && !unmarked.length ? <p className="ad-ok"><Ic n="ti-check" /> Nothing to fix.</p> : null}
      {must.map((i, k) => <div key={k} className="ad-msg bad"><b>Blocks publishing</b> · {i.q ? <span className="mono">{i.q}</span> : null} {i.msg} <button className="ad-link" onClick={() => goTo(b, i.q)}>Show me</button></div>)}
      {look.filter((i) => !/no outcome marker/.test(i.msg)).map((i, k) => <div key={k} className="ad-msg warn">{i.q ? <span className="mono">{i.q}</span> : null} {i.msg}</div>)}
      {unmarked.length ? <div className="ad-msg warn">{unmarked.length} question(s) have answers without an outcome, so RAYDAR can't suggest them: {unmarked.slice(0, 6).map((q) => <button key={q.id} className="ad-link" onClick={() => goTo(b, q.id)}>{plain(q.t).slice(0, 40)}</button>)}</div> : null}
    </section>
  );
}
function goTo(b, name) {
  const pages = b.esource.pages || [];
  for (let pi = 0; pi < pages.length; pi++) {
    const find = (list, path) => { for (let i = 0; i < (list || []).length; i++) { const el = list[i], p = path.concat(i); if (el.name === name) return p; if (el.elements) { const r = find(el.elements, p); if (r) return r; } } return null; };
    const p = find(pages[pi].elements, [pi]);
    if (p) { W.tab = /study\s*notes?/i.test(pages[pi].title || pages[pi].name || '') ? 'notes' : 'questions'; W.page = pi; W.sel = p; notify(); return; }
  }
}
export { CHOICE_TYPES, outcomeKey };
