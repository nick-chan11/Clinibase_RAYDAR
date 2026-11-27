import { S, bmi, upd, idReady, qcLeft, askConds, qcUse, siteOk, prevCall, detailsLeft } from '../engine/store.js';
import { NextStep } from './NextStep.jsx';
import { keyName } from '../engine/keys.js';
import { A, Ic, Seg } from './ui.jsx';
import { Err, Piece } from '../motion/components.jsx';
import { ImportButton, ImportNote } from './Import.jsx';
import { TestEntry, TestIdentity } from './TestMode.jsx';
import { TravelButton } from './Travel.jsx';

export function Identity() {
  const e = S.err;
  if (S.tm) return <TestIdentity />;
  return (
    <>
    <ImportNote />
    <div className="card">
      <Piece>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <p style={{ fontWeight: 500, margin: 0 }}>Confirm who you're speaking to</p>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {prevCall() && !S.pid && !S.dob ? <button className="pill" {...A('lastcall')} title="Started the next call by mistake? Go back to the last one, answers and all."><Ic n="ti-arrow-back-up" /> Back to the last call{prevCall().pid ? ' (' + prevCall().pid + ')' : ''}</button> : null}
            {S.resumed ? null : <ImportButton label="Resume a callback PDF" />}
          </span>
        </div>
        <p className="mut" style={{ margin: '0 0 10px', fontSize: 12 }}>Check against their profile. Only the PID is saved to any file.</p>
      </Piece>
      <Piece style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="lab" htmlFor="f-pid" style={{ display: 'block' }}>Clinibase PID</label>
          <input
            id="f-pid" type="text" data-f="pid" placeholder="p123456_1101" autoComplete="off" value={S.pid}
            aria-invalid={!!e.pid}
            onChange={(ev) => upd(() => { S.pid = ev.target.value.trim(); delete S.err.pid; })}
          />
          <Err msg={e.pid} />
        </div>
        <div>
          <label className="lab" htmlFor="f-dob" style={{ display: 'block' }}>Date of birth</label>
          <input id="f-dob" type="date" data-f="dob" value={S.dob} aria-invalid={!!e.dob}
            onChange={(ev) => upd(() => { S.dob = ev.target.value; delete S.err.dob; })} />
          <Err msg={e.dob} />
        </div>
      </Piece>
      {/* 2.11: participant details, to check against the CTMS profile. On screen only: never saved to any file. */}
      <Piece style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <label className="lab" htmlFor="f-nm" style={{ display: 'block' }}>Full name <span className="req">*</span></label>
          <input id="f-nm" type="text" data-f="nm" autoComplete="off" value={S.nm} onChange={(ev) => upd(() => { S.nm = ev.target.value; })} />
        </div>
        <div>
          <label className="lab" htmlFor="f-ph" style={{ display: 'block' }}>Phone number <span className="req">*</span></label>
          <input id="f-ph" type="tel" data-f="ph" autoComplete="off" value={S.ph} onChange={(ev) => upd(() => { S.ph = ev.target.value; })} />
        </div>
        <div>
          <label className="lab" htmlFor="f-em" style={{ display: 'block' }}>Email <span className="req">*</span></label>
          <input id="f-em" type="email" data-f="em" autoComplete="off" value={S.em} onChange={(ev) => upd(() => { S.em = ev.target.value.trim(); })} />
        </div>
        <div>
          <label className="lab" htmlFor="f-pc" style={{ display: 'block' }}>Postcode <span className="mut" style={{ fontWeight: 400 }}>(optional, for travel time)</span></label>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input id="f-pc" type="text" inputMode="numeric" data-f="pc" autoComplete="off" value={S.pc} style={{ maxWidth: 110 }} onChange={(ev) => upd(() => { S.pc = ev.target.value.replace(/\D/g, '').slice(0, 4); })} />
            {/^\d{4}$/.test(S.pc) ? <TravelButton label="Check travel" /> : null}
          </span>
        </div>
      </Piece>
      <Piece as="p" className="mut" style={{ fontSize: 11.5, margin: '8px 0 0', display: 'flex', gap: 6 }}>
        <Ic n="ti-lock" /><span>Name, phone and email stay on this screen to check against the CTMS profile. They are never saved to the PDF, the callback file or the Dr enquiry, and clear when the call ends. Only the postcode is sent to Google Maps, when you check travel.</span>
      </Piece>
      <Piece>
        <label data-shake="match" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 12 }}>
          <input type="checkbox" data-f="match" checked={S.match} onChange={(ev) => upd(() => { S.match = ev.target.checked; delete S.err.match; })} />{' '}
          Name, phone and email match the profile
        </label>
        {detailsLeft().length ? <span className="mut" style={{ fontSize: 12, marginLeft: 10 }}>Still needed: {detailsLeft().join(', ')}. You can carry on, but fill these in before booking.</span> : null}
        <Err msg={e.match} />
        <Err msg={e.id} />
      </Piece>
      {idReady() ? <NextStep style={{ marginTop: 12 }} /> : (
        <Piece style={{ marginTop: 12 }}>
          <button className="pill pri" {...A('confirm')}>Confirm identity</button>
          <span className="k">Enter</span>
        </Piece>
      )}
      <Piece><TestEntry /></Piece>
    </div>
    </>
  );
}

function Row({ label, children, item }) {
  return (
    <Piece className="row">
      <span style={{ fontWeight: 500, flex: 1, minWidth: 0 }}>{label}{item ? <Uses item={item} /> : null}</span>
      {children}
    </Piece>
  );
}

/** 2.7: which studies a Quick check answer matters to, read from their eSource questions. Hover for the question. */
function Uses({ item }) {
  const L = qcUse(item), here = L.filter((x) => siteOk(x.s)), other = L.length - here.length;
  if (!L.length) return null;
  const grp = (when, res) => here.filter((x) => x.r.when === when && x.r.result === res);
  const parts = [
    ['Needed by', grp('n', 'no'), 'var(--text-secondary)'],
    ['Rules out', grp('y', 'no'), 'var(--text-danger)'],
    ['Check for', grp('y', 'check').concat(grp('n', 'check')), 'var(--text-warning)'],
  ].filter((p) => p[1].length);
  const tip = (x) => x.s.c + ': ' + x.r.why + (x.r.qt ? '\nFrom the eSource: ' + x.r.qt + (x.r.a ? '\nAnswer: ' + x.r.a : '') : '');
  return (
    <span className="qcuse">
      {parts.map((p) => (
        <span key={p[0]} style={{ color: p[2] }}>{p[0]} {p[1].map((x, i) => <span key={x.s.c} title={tip(x)} className="mono">{i ? ', ' : ''}{x.s.c}</span>)}</span>
      ))}
      {other ? <span className="mut">{(parts.length ? '+' : '') + other} at other sites</span> : null}
    </span>
  );
}

export function QuickCheck() {
  const conds = askConds();
  const un = conds.filter((c) => S.cond[c[0]] == null).length;
  const b = bmi();
  return (
    <div className="card">
      <Row label="Biological sex"><Seg k="sex" opts={[['m', 'Male'], ['f', 'Female']]} cur={S.sex} /></Row>
      <Row label="Weight and height">
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="number" inputMode="decimal" aria-label="Weight in kg" placeholder="kg" value={S.wt} style={{ width: 60 }} onChange={(e) => upd(() => (S.wt = e.target.value))} />
          <input type="number" inputMode="decimal" aria-label="Height in cm" placeholder="cm" value={S.ht} style={{ width: 60 }} onChange={(e) => upd(() => (S.ht = e.target.value))} />
          <span className="mut" style={{ fontSize: 12, minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>{b != null ? 'BMI ' + b : ''}</span>
        </span>
      </Row>
      {/* 2.11: travel, optional; never rules a study in or out */}
      <Row label={<>Travel to the study sites <span className="mut" style={{ fontWeight: 400, fontSize: 12 }}>· optional{/^\d{4}$/.test(S.pc) ? ' · from ' + S.pc : ''}</span><div className="mut" style={{ fontWeight: 400, fontSize: 11.5 }}>Opens travel times in Google Maps. Doesn't rule any study in or out.</div></>}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TravelButton s={S.study} label="Check travel" />
          <Seg k="tvOk" opts={[['ok', 'OK'], ['far', 'Too far', 'warn']]} cur={S.tvOk} />
        </span>
      </Row>
      {S.sex !== 'm' ? <Row label="Pregnant or breastfeeding?"><Seg k="preg" opts={[['n', 'No'], ['y', 'Yes', 'bad']]} cur={S.preg} /></Row> : null}
      <Row label={<>Conditions <span className="mut" style={{ fontWeight: 400, fontSize: 12 }}>{un ? un + ' not asked' : 'all asked'}</span></>}>
        <button className="pill" {...A('norest')}>No to the rest</button>
      </Row>
      {conds.map((c) => (
        <div className="row" key={c[0]} style={{ padding: '5px 0 5px 10px' }}>
          <span style={{ flex: 1, minWidth: 0 }}>{c[1]}<Uses item={c[0]} /></span>
          <Seg k={'cond.' + c[0]} opts={[['n', 'No'], ['y', 'Yes', 'warn']]} cur={S.cond[c[0]]} />
        </div>
      ))}
      <Row label="Regular medications?" item="meds"><Seg k="meds" opts={[['n', 'No'], ['y', 'Yes', 'warn']]} cur={S.meds} /></Row>
      <Row label="Smokes, vapes or nicotine?" item="smoke"><Seg k="smoke" opts={[['n', 'No'], ['y', 'Yes', 'warn']]} cur={S.smoke} /></Row>
      <Row label="Away or on holiday soon?">
        <button className="pill" {...A('plan')}>
          <Ic n="ti-calendar-stats" /> {S.away.length ? S.away.length + ' period' + (S.away.length > 1 ? 's' : '') + ' added' : 'Add away dates'}
        </button>
      </Row>
      {/* 2.4: what's left, then a prompt to move on once everything is asked */}
      {qcLeft().length ? (
        <p className="mut" style={{ fontSize: 12, margin: '10px 0 0' }}>Still to ask: {qcLeft().join(', ')}</p>
      ) : null}
      <NextStep sticky style={{ marginTop: 12 }} />
    </div>
  );
}
