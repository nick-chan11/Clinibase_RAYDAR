/* RAYDAR 2.10: test mode. For recruiters getting to know a study and for anyone testing RAYDAR: no identity,
   date or study-information checks, any question in any order, and everything else still works.
   It must never be mistaken for a real call: a pink banner that stays in view, a pink frame round the page
   (body.tm in styles.css), "Test mode" in the header, and PDFs stamped TEST with names starting TEST-. */
import { S } from '../engine/store.js';
import { A, Ic } from './ui.jsx';

/** The banner across the top while test mode is on */
export function TestBanner() {
  if (!S.tm) return null;
  return (
    <div className="tmbar" role="status">
      <span><b className="tmbar-k">TEST MODE</b> For exploring studies and testing RAYDAR. Checks are switched off and nothing here is a real pre-screen. <b>Don't enter a real participant's details.</b> Switch back to normal mode before a real call.</span>
      <button className="pill tmbtn" {...A('tmoff')}><Ic n="ti-arrow-back-up" /> Back to normal mode</button>
    </div>
  );
}

/** The way in, under the identity check */
export function TestEntry() {
  return (
    <div className="tment">
      <span><b>Just looking around?</b> Explore any study without a participant: no identity, date or study-info checks.</span>
      <button className="pill tmbtn" {...A('tmon')}><Ic n="ti-ghost" /> Explore in test mode</button>
    </div>
  );
}

/** The Identity step while test mode is on */
export function TestIdentity() {
  return (
    <div className="card">
      <p style={{ fontWeight: 500, margin: 0 }}>Identity check skipped in test mode</p>
      <p className="mut" style={{ margin: '4px 0 10px', fontSize: 12 }}>There's no participant in test mode. Pick any study in Pivotable studies to open its questions, or try Quick check.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="pill pri" {...A('go:qc')}>Go to Quick check</button>
        <button className="pill tmbtn" {...A('tmoff')}><Ic n="ti-arrow-back-up" /> Back to normal mode</button>
      </div>
    </div>
  );
}
