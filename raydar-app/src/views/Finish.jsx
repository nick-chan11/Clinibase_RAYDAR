import { motion } from 'motion/react';
import { useState } from 'react';
import { S, sug, reason, qset, matchP, selC, fmtR, needsReview, upd, act } from '../engine/store.js';
import { summary, savePdf, CALLBACK_REASONS } from '../pdf/report.js';
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
  const name = S.savedName || summary(k, { dr: S.drMode, cbr: S.cbr }).fileName;
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
      <Piece as="p" className="mono" style={{ margin: '0 0 8px', wordBreak: 'break-all' }}>{name}</Piece>
      <Piece as="p" className="mut" style={{ fontSize: 12, margin: '0 0 12px' }}>It's in your Downloads folder. Upload it to the participant profile in CTMS. Nothing else from this call is kept. To carry on later, use Import callback on this PDF.</Piece>
      <Piece style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="pill pri" {...A('new')}>Start next call <Ic n="ti-arrow-right" /> <span className="k">{keyName('cont')}</span></button>
        <button className="pill" {...A('unsave')}><Ic n="ti-arrow-back-up" /> Wrong outcome? Change it</button>
      </Piece>
      <Piece as="p" className="mut" style={{ fontSize: 11, margin: '8px 0 0' }}>Changing it keeps every answer. The corrected PDF is marked as a revision and names the file it replaces; delete the first one from CTMS.</Piece>
    </div>
  );
}

export function Finish() {
  const sg = sug(), k = S.fin || sg;
  if (S.saved) return <Saved k={k} />;
  const O = [['c', 'Clear to book', 'ok', 'No issues found'], ['d', 'Doctor enquiry', 'warn', 'Raise the flagged items with the doctors'], ['x', 'Exclude', 'bad', reason() || 'Do not book'], ['cb', 'Save for callback', '', 'Resume later from the PDF']];
  const [err, setErr] = useState('');
  const opt = { dr: S.drMode, cbr: S.cbr }, sm = summary(k, opt);
  const save = () => {
    try { const r = savePdf(k, opt); setErr(''); upd(() => { S.savedName = r.fileName; }); act('save'); }
    catch (e) { setErr('The PDF couldn\'t be made: ' + (e && e.message ? e.message : e) + '. Nothing was lost: try again, or tell your team lead.'); }
  };
  const L = qset(), done = L.filter((q) => S.out[q.id]).length, cnt = (t) => S.log.filter((e) => e.t === t).length;
  const pr = S.log.filter((e) => { const p = matchP(e); return p && p.o === 'x'; }).length, sc = S.study ? selC() : [];
  const flags = L.filter((q) => S.out[q.id] === 'x' || S.out[q.id] === 'd');
  return (
    <div className="card">
      {S.prevFile ? (
        <div role="status" style={{ fontSize: 12, padding: '8px 10px', marginBottom: 10, borderLeft: '3px solid var(--border-warning)', background: 'var(--bg-warning)', borderRadius: 6 }}>
          Correcting <span className="mono" style={{ wordBreak: 'break-all' }}>{S.prevFile}</span>. Pick the right outcome and save again: the new PDF is <b style={{ fontWeight: 600 }}>revision {S.rev}</b> and says which file it replaces.
        </div>
      ) : null}
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
      {k === 'd' ? (
        <Piece>
          <p className="lab" style={{ marginTop: 12 }}>Booking while the doctor checks</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} role="radiogroup" aria-label="Booking while the doctor checks">
            {[['hold', 'Hold the booking', 'Saved as a callback: Doctor enquiry pending'], ['book', 'Book now', 'Cancel if the doctor says no']].map((x) => (
              <button key={x[0]} role="radio" aria-checked={S.drMode === x[0]} {...A('drmode:' + x[0])} className="pill wide"
                style={{ textAlign: 'left', padding: 8, background: 'var(--surface-1)', outline: S.drMode === x[0] ? '2px solid var(--border-accent)' : 'none', outlineOffset: 1 }}>
                <span style={{ fontWeight: 500 }}>{x[1]}</span><br /><span className="mut" style={{ fontSize: 11 }}>{x[2]}</span>
              </button>
            ))}
          </div>
        </Piece>
      ) : null}
      {k === 'cb' ? (
        <Piece>
          <p className="lab" style={{ marginTop: 12 }}>Why a callback?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="Callback reason">
            {CALLBACK_REASONS.map((r) => (
              <button key={r[0] || 'other'} role="radio" aria-checked={S.cbr === r[0]} {...A('cbr:' + encodeURIComponent(r[0]))} className={'pill' + (S.cbr === r[0] ? ' pri' : '')} style={{ fontSize: 12 }}>{r[1]}</button>
            ))}
          </div>
        </Piece>
      ) : null}
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
        <label className="lab" htmlFor="f-callnotes" style={{ display: 'block', marginTop: 12 }}>Call notes for the clinic <span className="mut" style={{ fontWeight: 400 }}>(printed on page 1)</span></label>
        <textarea id="f-callnotes" data-f="callnotes" rows={3} value={S.finalNotes} placeholder="Anything the coordinator should know. No names, phone numbers or emails."
          style={{ width: '100%', boxSizing: 'border-box' }} onChange={(e) => upd(() => { S.finalNotes = e.target.value; })} />
      </Piece>
      <Piece>
        <p className="lab" style={{ marginTop: 10 }}>The PDF will say</p>
        <div className={'soft verdict ' + sm.verdictKind} style={{ fontSize: 12, fontWeight: 600 }}>
          {sm.verdictLabel}{sm.isCallback ? <div style={{ fontWeight: 500, marginTop: 2 }}>CALLBACK NEEDED{sm.callbackReason ? ': ' + sm.callbackReason : ''}</div> : null}
        </div>
        <p className="lab" style={{ marginTop: 10 }}>File name</p>
        <div className="soft mono" style={{ wordBreak: 'break-all' }}>{sm.fileName}</div>
      </Piece>
      {err ? <p role="alert" style={{ color: 'var(--text-danger)', fontSize: 12, margin: '8px 0 0' }}>{err}</p> : null}
      <Piece style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 }}>
        <button className="pill pri" onClick={save}><Ic n="ti-download" /> Save PDF</button>
      </Piece>
    </div>
  );
}
