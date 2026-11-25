import { useState } from 'react';
import { W, notify, publishQc, markQc } from './ws.js';
import { ALL } from '../esource/studies.js';

const Ic = ({ n }) => <i className={'ti ' + n} aria-hidden="true" />;
const mark = () => markQc();

/** The Quick check settings file: conditions it can ask, extra rules, rules switched off. */
export function QcPage() {
  const qc = W.qc;
  qc.conditions = qc.conditions || []; qc.rules = qc.rules || []; qc.ignore = qc.ignore || [];
  const [adding, setAdding] = useState(false);
  return (
    <div className="ad-page">
      <div className="ad-row"><h1>Quick check settings</h1><span style={{ flex: 1 }} />
        {W.qcDirty ? <span className="ad-tag dash">Unpublished changes</span> : null}
        <button className="ad-btn pri" disabled={!W.qcDirty} onClick={publishQc}>Publish Quick check settings</button></div>
      <p className="ad-mut">Most rules are read from each study's own questions. Here are the conditions Quick check can ask about (one shows only when a study uses it), rules the questions don't spell out, and rules switched off because they were read wrongly.</p>

      <div className="ad-card">
        <h2>Conditions</h2>
        <div className="ad-table">
          <div className="ad-tr ad-th qc"><span>Shown as</span><span>Found by these words in a question</span><span>Only for</span><span>Used by</span><span /></div>
          {qc.conditions.map((c, i) => {
            const used = ALL.filter((s) => (s.qc || []).some((r) => r.item === c.key)).map((s) => s.c);
            return (
              <div key={c.key + i} className="ad-tr qc">
                <input aria-label="Label" value={c.label} onChange={(e) => { c.label = e.target.value; mark(); }} />
                <input aria-label="Words" className="mono" value={c.match} onChange={(e) => { c.match = e.target.value; mark(); }} />
                <select aria-label="Only for" value={c.sex || ''} onChange={(e) => { if (e.target.value) c.sex = e.target.value; else delete c.sex; mark(); }}><option value="">Everyone</option><option value="m">Men</option><option value="f">Women</option></select>
                <span className="ad-small">{used.length ? used.join(', ') : <span className="ad-mut">No study yet</span>}</span>
                <button className="ad-btn sm ghost" aria-label={'Remove ' + c.label} onClick={() => { if (window.confirm('Remove "' + c.label + '" from Quick check?')) { qc.conditions.splice(i, 1); mark(); } }}><Ic n="ti-trash" /></button>
              </div>
            );
          })}
        </div>
        {adding ? <NewCondition done={() => setAdding(false)} /> : <button className="ad-btn" onClick={() => setAdding(true)}><Ic n="ti-plus" /> Add a condition</button>}
        <p className="ad-mut ad-small">"Words" is a pattern: separate alternatives with | (e.g. <span className="mono">eczema|atopic dermatitis</span>). It must match the condition's name in the study's own question.</p>
      </div>

      <div className="ad-card">
        <h2>Extra rules</h2>
        {!qc.rules.length ? <p className="ad-mut">None.</p> : qc.rules.map((r, i) => (
          <div key={i} className="ad-rule">
            <b>{r.file.replace(/ - pre-screening\.json$/, '')}</b>: {r.item} {r.when === 'y' ? 'yes' : 'no'} → {r.result === 'no' ? 'rules it out' : 'check'} · "{r.why}"
            <div className="ad-mut ad-small">From the eSource: "{r.source}"</div>
            <button className="ad-link" onClick={() => { qc.rules.splice(i, 1); mark(); }}>Remove</button>
          </div>
        ))}
        <p className="ad-mut ad-small">Add a rule from the study's own page (Quick check and lists), so it carries the eSource wording it came from.</p>
      </div>

      <div className="ad-card">
        <h2>Rules switched off</h2>
        {!qc.ignore.length ? <p className="ad-mut">None.</p> : qc.ignore.map((g, i) => (
          <div key={i} className="ad-rule"><b>{g.file.replace(/ - pre-screening\.json$/, '')}</b>: question <span className="mono">{g.question}</span>{g.item ? ' (' + g.item + ')' : ''} <button className="ad-link" onClick={() => { qc.ignore.splice(i, 1); mark(); }}>Switch back on</button></div>
        ))}
      </div>
    </div>
  );
}

function NewCondition({ done }) {
  const [label, setLabel] = useState(''), [match, setMatch] = useState('');
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
  let bad = '';
  try { if (match) new RegExp(match, 'i'); } catch (e) { bad = 'Those words aren\'t a valid pattern'; }
  const clash = W.qc.conditions.some((c) => c.key === key);
  return (
    <div className="ad-row" style={{ alignItems: 'flex-end' }}>
      <label className="ad-field">Shown as <input value={label} onChange={(e) => { setLabel(e.target.value); if (!match) setMatch(''); }} placeholder="e.g. Psoriasis" /></label>
      <label className="ad-field">Words <input className="mono" value={match} onChange={(e) => setMatch(e.target.value)} placeholder="e.g. psoriasis" /></label>
      <button className="ad-btn pri" disabled={!label || !match || !!bad || clash} onClick={() => { W.qc.conditions.push({ key, label, match }); mark(); done(); }}>Add</button>
      <button className="ad-btn ghost" onClick={done}>Cancel</button>
      {bad || (clash ? 'There is already a condition with that name' : '') ? <span className="ad-err">{bad || 'There is already a condition with that name'}</span> : null}
    </div>
  );
}
