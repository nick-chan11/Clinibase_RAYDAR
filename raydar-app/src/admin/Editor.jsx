import { W, notify, changed, undo, redo, discardDraft } from './ws.js';
import { nameParts } from '../esource/convert.js';
import { Builder } from './Builder.jsx';
import { DatesTab } from './Dates.jsx';
import { ChecksTab } from './Checks.jsx';
import { PublishTab } from './Publish.jsx';

const Ic = ({ n }) => <i className={'ti ' + n} aria-hidden="true" />;
const TABS = [['questions', 'Questions'], ['notes', 'Study notes and call script'], ['dates', 'Dates and visits'], ['checks', 'Quick check and lists'], ['publish', 'Preview and publish']];

/** One study, being edited */
export function Editor() {
  const b = W.drafts[W.file];
  if (!b) { W.view = 'studies'; return null; }
  const { site, code } = nameParts(b.file, b.esource);
  const dirty = changed(b.file);
  return (
    <div className="ad-editor">
      <div className="ad-row ad-ehead">
        <button className="ad-link" onClick={() => { W.view = 'studies'; notify(); }}>‹ Studies</button>
        <span className="ad-code mono">{code}</span>
        <span className="ad-tag site">{site === 'Veritus' ? 'Veritus Melbourne' : site}</span>
        <span className={'ad-tag ' + (dirty ? 'dash' : 'ok')}>{b.isNew ? 'New, not published' : dirty ? 'Unpublished changes' : 'Same as live'}</span>
        {b.savedBy ? <span className="ad-mut ad-small">draft saved by {b.savedBy}</span> : null}
        <span style={{ flex: 1 }} />
        <button className="ad-btn sm" onClick={undo} disabled={!(W.undo[b.file] || []).length}><Ic n="ti-arrow-back-up" /> Undo</button>
        <button className="ad-btn sm" onClick={redo} disabled={!(W.redo[b.file] || []).length}><Ic n="ti-arrow-forward-up" /> Redo</button>
        {dirty ? <button className="ad-btn sm ghost" onClick={() => { if (window.confirm('Throw away every unpublished change to ' + code + '?')) discardDraft(b.file); }}>Discard draft</button> : null}
        {W.tab === 'publish'
          ? <button className="ad-btn pri" onClick={() => { const el = document.getElementById('ad-publish'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); const f = el.querySelector('input:not([disabled]), button:not([disabled])'); if (f) f.focus({ preventScroll: true }); } }}>Go to Publish ↓</button>
          : <button className="ad-btn pri" onClick={() => { W.tab = 'publish'; notify(); }}>Preview and publish</button>}
      </div>
      <nav className="ad-etabs" role="tablist" aria-label="Study parts">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={W.tab === k} className={W.tab === k ? 'on' : ''} onClick={() => { W.tab = k; W.sel = null; notify(); }}>{l}</button>)}
      </nav>
      {W.tab === 'questions' ? <Builder /> : W.tab === 'notes' ? <Builder notes /> : W.tab === 'dates' ? <DatesTab b={b} /> : W.tab === 'checks' ? <ChecksTab b={b} /> : <PublishTab b={b} />}
    </div>
  );
}
