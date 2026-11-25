/* Quick check rules, prohibited lists and the file check for one study, on its draft. */
import { useState } from 'react';
import { W, edit, notify, draftStudy, markQc } from './ws.js';
import { plain } from '../esource/convert.js';
import { CONDS } from '../esource/qcrules.js';
import { CHOICE_TYPES, outcomeKey } from './ops.js';
import { TextBox } from './TextBox.jsx';
import { Prohibited } from './ProItems.jsx';

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

/* What a Quick check item means in a sentence */
const ITEM_WORDS = {
  smoke: ['smokes, vapes or uses nicotine', "doesn't smoke, vape or use nicotine"],
  meds: ['takes regular medications', "doesn't take regular medications"],
};
function itemLabel(item) { const c = CONDS.find((x) => x[0] === item); return item === 'smoke' ? 'Smokes, vapes or nicotine' : item === 'meds' ? 'Regular medications' : c ? c[1] : item; }
function said(item, when) {
  if (ITEM_WORDS[item]) return ITEM_WORDS[item][when === 'y' ? 0 : 1];
  const l = itemLabel(item); const low = /^[A-Z]{2,}/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1);
  return when === 'y' ? 'has ' + low : "doesn't have " + low;
}
const doesWhat = (res) => (res === 'no' ? 'rules this study out' : 'keeps this study, flagged amber to check');

function Rules({ b, s }) {
  const qc = W.qc;
  const [form, setForm] = useState(null);
  const toggle = (r) => {
    qc.ignore = qc.ignore || [];
    const i = qc.ignore.findIndex((g) => g.file === b.file && g.question === r.q && (!g.item || g.item === r.item));
    if (i >= 0) qc.ignore.splice(i, 1); else qc.ignore.push({ file: b.file, question: r.q, item: r.item });
    markQc();
  };
  const offRows = (qc.ignore || []).filter((g) => g.file === b.file);
  const items = [['smoke', 'Smokes, vapes or nicotine'], ['meds', 'Regular medications']].concat(CONDS.map((c) => [c[0], c[1]]));
  const code = s.code || 'this study';
  return (
    <section className="ad-card ad-rules-card">
      <h2>Quick check rules</h2>
      <p>Quick check is the first screen of a call: sex, BMI, conditions, regular medications and smoking. A rule tells it what one of those answers means for <b>{code}</b>, so the study moves up or down the Pivotable studies list before any questions are asked.</p>
      <details className="ad-how">
        <summary>How RAYDAR works out the rules</summary>
        <ol>
          <li><b>It reads them from the study's own questions.</b> A question that asks about a Quick check item directly ("Do you have…?", "Have you been diagnosed with…?", "Do you smoke…?") and whose answers carry outcome markers becomes a rule. Follow-ups, "is this okay?" agreements, tests and treatment questions are left for the pre-screen.</li>
          <li><b>The answers decide what the rule does.</b> If every answer that matches the participant excludes (🛑), the study is <span className="bad">ruled out</span>. If they point to the doctors (⚠️), it's <span className="warn">kept and flagged to check</span>. If any of them continues (✅), there's no rule: the pre-screen sorts it out.</li>
          <li><b>Example:</b> SRSD asks "Have you been diagnosed with a form of diabetes?" with "No - exclude 🛑". So a participant who doesn't have type 2 diabetes sees SRSD ruled out: "Recruits type 2 diabetes only".</li>
          <li><b>You can correct it.</b> Switch off a rule that's been read wrongly. Add one when the eSource only says it in a note (for example, CORSERA: "If the PT is taking any prescription medications daily they are not suitable"). An added rule has to quote that eSource wording.</li>
        </ol>
      </details>

      <div className="ad-rulelist">
        {(s.qc || []).map((r, i) => (
          <div key={i} className={'ad-rule2 ' + (r.result === 'no' ? 'r-out' : 'r-check')}>
            <div className="ad-rule2-main">
              <span className="ad-rule2-if">If the participant <b>{said(r.item, r.when)}</b></span>
              <span className="ad-rule2-then">→ {doesWhat(r.result)}</span>
              <span className="ad-rule2-see">Recruiters see: <b>{r.why}</b></span>
              <span className="ad-mut ad-small">{r.auto ? 'Read from the question "' + r.qt.slice(0, 120) + '" (answer "' + r.a.slice(0, 60) + '")' : 'Added by an admin, from the eSource: "' + r.qt.slice(0, 120) + '"'}</span>
            </div>
            {r.auto
              ? <button className="ad-btn sm ghost" onClick={() => toggle(r)}>Switch off</button>
              : <button className="ad-btn sm ghost" onClick={() => { const k = qc.rules.findIndex((x) => x.file === b.file && x.item === r.item && x.when === r.when); if (k >= 0) { qc.rules.splice(k, 1); markQc(); } }}>Remove</button>}
          </div>
        ))}
        {offRows.map((g, i) => <div key={'off' + i} className="ad-rule2 off"><div className="ad-rule2-main"><span>Switched off: the rule read from question <span className="mono">{g.question}</span>{g.item ? ' (' + itemLabel(g.item) + ')' : ''}</span></div><button className="ad-btn sm ghost" onClick={() => { qc.ignore.splice(qc.ignore.indexOf(g), 1); markQc(); }}>Switch back on</button></div>)}
        {!(s.qc || []).length && !offRows.length ? <p className="ad-mut">No rules yet. Quick check still checks age, BMI, sex and pregnancy for {code}; its other answers don't move the study.</p> : null}
      </div>

      {(s.qcMissing || []).map((m, i) => (
        <div key={'m' + i} className="ad-msg warn">This study needs <b>{m.name}</b>, which Quick check doesn't ask about ("{m.qt.slice(0, 100)}"). Add it as a condition on the Quick check settings page, and RAYDAR will read the rule from the question.
          <button className="ad-btn sm" onClick={() => { W.view = 'qc'; notify(); }}>Go there</button></div>
      ))}

      {form ? (
        <div className="ad-ruleform2">
          <h3>Add a rule</h3>
          <div className="ad-sentence">
            <span>If the participant's Quick check answer to</span>
            <select aria-label="Quick check item" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}>{items.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <span>is</span>
            <select aria-label="Answer" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })}><option value="y">Yes</option><option value="n">No</option></select>
            <span>then</span>
            <select aria-label="What happens" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}><option value="check">keep {code}, flagged to check</option><option value="no">rule {code} out</option></select>
          </div>
          <label className="ad-field">What recruiters see next to the study (short)
            <input value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} placeholder={form.result === 'no' ? 'e.g. Excludes daily prescription medication' : "e.g. Daily prescription medication isn't suitable (contraception is okay)"} />
          </label>
          <label className="ad-field">Where the eSource says this (required, copy it exactly)
            <textarea rows={2} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. If the PT is taking any prescription medications daily they are not suitable (contraception is okay)" />
          </label>
          <div className={'ad-rulepreview ' + (form.result === 'no' ? 'r-out' : 'r-check')}>
            <b>In Quick check:</b> a participant who {said(form.item, form.when)} will see {code} {form.result === 'no' ? 'ruled out' : 'kept, flagged amber'}{form.why.trim() ? <>, with <b>{form.why.trim()}</b></> : ''}.
          </div>
          {form.source.trim().length > 0 && form.source.trim().length < 10 ? <p className="ad-err">Copy the whole sentence from the eSource.</p> : null}
          <div className="ad-row"><button className="ad-btn pri" disabled={!form.why.trim() || form.source.trim().length < 10} onClick={() => { (qc.rules = qc.rules || []).push({ file: b.file, ...form, why: form.why.trim(), source: form.source.trim() }); markQc(); setForm(null); }}>Add the rule</button><button className="ad-btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      ) : <button className="ad-btn" onClick={() => setForm({ item: 'meds', when: 'y', result: 'check', why: '', source: '' })}><Ic n="ti-plus" /> Add a rule</button>}
      {W.qcDirty ? <p className="ad-mut ad-small">Quick check changes are saved with this study when you publish it (or from the Quick check settings page). They apply to every study.</p> : null}
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
