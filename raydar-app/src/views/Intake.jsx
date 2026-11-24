import { S, bmi, upd, idReady, qcLeft } from '../engine/store.js';
import { NextStep } from './NextStep.jsx';
import { keyName } from '../engine/keys.js';
import { CONDS as CONDS_LIST } from '../engine/data.js';
import { A, Ic, Seg } from './ui.jsx';
import { Err, Piece } from '../motion/components.jsx';
import { ImportButton, ImportNote } from './Import.jsx';

export function Identity() {
  const e = S.err;
  return (
    <>
    <ImportNote />
    <div className="card">
      <Piece>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <p style={{ fontWeight: 500, margin: 0 }}>Confirm who you're speaking to</p>
          {S.resumed ? null : <ImportButton label="Resume a callback PDF" />}
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
      <Piece>
        <label data-shake="match" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 12 }}>
          <input type="checkbox" data-f="match" checked={S.match} onChange={(ev) => upd(() => { S.match = ev.target.checked; delete S.err.match; })} />{' '}
          Name, phone and email match the profile
        </label>
        <Err msg={e.match} />
        <Err msg={e.id} />
      </Piece>
      {idReady() ? <NextStep style={{ marginTop: 12 }} /> : (
        <Piece style={{ marginTop: 12 }}>
          <button className="pill pri" {...A('confirm')}>Confirm identity</button>
          <span className="k">Enter</span>
        </Piece>
      )}
    </div>
    </>
  );
}

function Row({ label, children }) {
  return (
    <Piece className="row">
      <span style={{ fontWeight: 500 }}>{label}</span>
      {children}
    </Piece>
  );
}

export function QuickCheck() {
  const conds = CONDS_LIST.filter((c) => !(c[0] === 'mphl' && S.sex === 'f'));
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
      {S.sex !== 'm' ? <Row label="Pregnant or breastfeeding?"><Seg k="preg" opts={[['n', 'No'], ['y', 'Yes', 'bad']]} cur={S.preg} /></Row> : null}
      <Row label={<>Conditions <span className="mut" style={{ fontWeight: 400, fontSize: 12 }}>{un ? un + ' not asked' : 'all asked'}</span></>}>
        <button className="pill" {...A('norest')}>No to the rest</button>
      </Row>
      {conds.map((c) => (
        <div className="row" key={c[0]} style={{ padding: '5px 0 5px 10px' }}>
          <span>{c[1]}</span>
          <Seg k={'cond.' + c[0]} opts={[['n', 'No'], ['y', 'Yes', 'warn']]} cur={S.cond[c[0]]} />
        </div>
      ))}
      <Row label="Regular medications?"><Seg k="meds" opts={[['n', 'No'], ['y', 'Yes', 'warn']]} cur={S.meds} /></Row>
      <Row label="Smokes, vapes or nicotine?"><Seg k="smoke" opts={[['n', 'No'], ['y', 'Yes', 'warn']]} cur={S.smoke} /></Row>
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
