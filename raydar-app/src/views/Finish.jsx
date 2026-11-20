import { motion } from 'motion/react';
import { S, sug, reason, qset, matchP, selC, fname, fmtR, needsReview } from '../engine/store.js';
import { A, Ic, B } from './ui.jsx';
import { keyName } from '../engine/keys.js';
import { Piece } from '../motion/components.jsx';
import { spring, tr } from '../motion/tokens.js';

function FinWarn({ L }) {
  if (!S.study) return null;
  const un = L.filter((z) => !S.out[z.id]), rv = L.filter(needsReview), pk = un.filter((z) => S.park[z.id]).length;
  const box = (c, h, list) => (
    <div style={{ fontSize: 12, marginTop: 10, padding: '6px 10px', borderLeft: '3px solid var(--border-' + c + ')', background: 'var(--surface-1)', borderRadius: 0 }}>
      <B style={{ color: 'var(--text-' + c + ')' }}>{h}</B>{' '}
      {list.slice(0, 8).map((z, k) => <span key={z.id}>{k ? ', ' : ''}<button className="lnk" {...A('goq:' + z.id)}>Q{L.indexOf(z) + 1}</button></span>)}
      {list.length > 8 ? ' …' : ''}
    </div>
  );
  return (
    <>
      {un.length ? box('warning', un.length + ' question' + (un.length > 1 ? 's' : '') + ' not answered' + (pk ? ' (' + pk + ' parked)' : '') + ':', un) : null}
      {rv.length ? box('danger', rv.length + ' answer' + (rv.length > 1 ? 's' : '') + ' to review:', rv) : null}
    </>
  );
}

/** The end of the flow (peak-end rule): say what happened and what comes next. */
function Saved({ k }) {
  return (
    <div className="card">
      <Piece as="p" style={{ fontWeight: 500, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <motion.i
            className="ti ti-circle-check" aria-hidden="true" style={{ color: 'var(--text-success)', fontSize: 18 }}
            initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { ...spring(0.45), delay: 0.12 } }}
          />
          {/* secondary action: a ring scales 1 → 1.4 and fades, starting just after the check, a third of its size */}
          <motion.span
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--fill-success)' }}
            initial={{ scale: 1, opacity: 0 }} animate={{ scale: 1.4, opacity: [0, 0.5, 0], transition: tr(0.5, 'out', { delay: 0.2 }) }}
          />
        </span>
        Saved
      </Piece>
      <Piece as="p" className="mono" style={{ margin: '0 0 8px', wordBreak: 'break-all' }}>{fname(k)}</Piece>
      <Piece as="p" className="mut" style={{ fontSize: 12, margin: '0 0 12px' }}>Upload it to the participant profile in CTMS. Nothing else from this call is kept.</Piece>
      <Piece><button className="pill pri" {...A('new')}>Start next call <Ic n="ti-arrow-right" /> <span className="k">{keyName('cont')}</span></button></Piece>
    </div>
  );
}

export function Finish() {
  const sg = sug(), k = S.fin || sg;
  if (S.saved) return <Saved k={k} />;
  const O = [['c', 'Clear to book', 'ok', 'No issues found'], ['d', 'Doctor enquiry', 'warn', 'Book and raise flagged items'], ['x', 'Exclude', 'bad', reason() || 'Do not book'], ['cb', 'Save for callback', '', 'Resume later from the PDF']];
  const L = qset(), done = L.filter((q) => S.out[q.id]).length, cnt = (t) => S.log.filter((e) => e.t === t).length;
  const pr = S.log.filter((e) => { const p = matchP(e); return p && p.o === 'x'; }).length, sc = S.study ? selC() : [];
  const flags = L.filter((q) => S.out[q.id] === 'x' || S.out[q.id] === 'd');
  return (
    <div className="card">
      <Piece as="p" style={{ fontWeight: 500, margin: '0 0 8px' }}>How did the call end?</Piece>
      <Piece style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} role="radiogroup" aria-label="Call outcome">
        {O.map((x) => (
          <button key={x[0]} role="radio" aria-checked={k === x[0]} {...A('fin:' + x[0])} className={'pill wide ' + x[2]}
            style={{ textAlign: 'left', padding: 10, outline: k === x[0] ? '2px solid var(--border-accent)' : 'none', outlineOffset: 1, ...(x[2] ? null : { background: 'var(--surface-1)' }) }}>
            <span style={{ fontWeight: 500 }}>{x[1]}</span>{sg === x[0] ? <span className="mut" style={{ fontSize: 11 }}> · suggested</span> : null}
            <br /><span style={{ fontSize: 11 }}>{x[3]}</span>
          </button>
        ))}
      </Piece>
      {k === 'd' || k === 'cb' ? <button className="pill warn wide" {...A('dre:open')} style={{ marginTop: 8, width: '100%' }}><Ic n="ti-stethoscope" /> Create Dr enquiry text</button> : null}
      <FinWarn L={L} />
      <Piece>
        <p className="lab" style={{ marginTop: 12 }}>On the PDF</p>
        <div className="soft" style={{ fontSize: 12 }}>
          {S.study ? S.study.c + ' · ' + done + ' of ' + L.length + ' answered' : 'Quick Check only'}
          {sc.length ? <><br />Selected cohorts: {sc.map((c) => c.n + ' (' + fmtR(c.in, c.out) + ')').join(', ')}</> : null}
          <br />{cnt('med')} medications, {cnt('otc')} supplements or OTC, {cnt('hx')} history items
          {pr ? <>, <span style={{ color: 'var(--text-danger)' }}>{pr} on the prohibited list</span></> : null}
          {flags.length ? (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {flags.map((q) => (
                <div key={q.id} style={{ fontSize: 12 }}>
                  <span className={'pill bdg ' + (S.out[q.id] === 'x' ? 'bad' : 'warn')}>{S.out[q.id] === 'x' ? 'Exclude' : 'Doctor'}</span> {(S.why[q.id] && S.why[q.id][0]) || q.s}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Piece>
      <Piece>
        <p className="lab" style={{ marginTop: 10 }}>File name</p>
        <div className="soft mono" style={{ wordBreak: 'break-all' }}>{fname(k)}</div>
      </Piece>
      <Piece style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 }}>
        <button className="pill pri" {...A('save')}>Save PDF</button>
      </Piece>
    </div>
  );
}
