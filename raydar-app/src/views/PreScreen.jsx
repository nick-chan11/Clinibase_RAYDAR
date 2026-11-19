import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  S, upd, quiet, curQ, srcQ, selC, selTypes, avl, cStat, cKey, rk, fmt, fmtR, age, bmi, sugQ, ocls, oc,
  needsReview, frontier, short,
} from '../engine/store.js';
import { A, Ic, B, Emph, Hl, FuHint, PanelHead, Resizable } from './ui.jsx';
import { MedLog } from './MedLog.jsx';
import { Err, Expander, Piece } from '../motion/components.jsx';
import { DUR, tr } from '../motion/tokens.js';

/** Keep showing the last real value while something closes. */
function useLatest(v) {
  const r = useRef(v);
  if (v) r.current = v;
  return v || r.current;
}

/* ---------------- Before questions: dates and study information ---------------- */
const Say = () => <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-accent)' }}><Ic n="ti-microphone" /> Say</div>;
const voice = { fontFamily: 'var(--font-voice)', fontSize: 15, lineHeight: 1.55, margin: '0 0 8px' };
const h3 = { fontSize: 14, fontWeight: 500, margin: '8px 0 2px' };

export function InfoBlock({ s }) {
  const T = selTypes(s), all = Object.keys(s.types), show = T.length ? T : all;
  const part = (title, txt) => txt ? <><h3 style={h3}>{title}</h3><Say /><p style={voice}><Emph t={txt} nums /></p></> : null;
  const td = { verticalAlign: 'top', padding: '1px 0' };
  return (
    <>
      {s.info ? <>{part('Purpose and study drug', s.info.p)}{part('Study design', s.info.d)}{part('Schedule', s.info.sch)}{part('Reimbursement', s.info.pay)}</> : null}
      <h3 style={{ fontSize: 14, fontWeight: 500, margin: '10px 0 4px' }}>{T.length ? 'Selected cohort details' : 'Cohort details'}</h3>
      {T.length ? null : <p style={{ fontSize: 12, margin: '0 0 6px', fontStyle: 'italic' }} className="mut">No cohort selected yet, so every cohort type is shown.</p>}
      {show.map((k) => {
        const t = s.types[k];
        return (
          <div className="soft" key={k} style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{t.l}</div>
            <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td className="mut" style={{ ...td, width: 92 }}>In clinic</td><td><Emph t={t.stay} /></td></tr>
                <tr><td className="mut" style={td}>Follow-up</td><td><Emph t={t.fu} /></td></tr>
                <tr><td className="mut" style={td}>Reimbursement</td><td><B>{t.pay}</B> if dosed{t.alt ? ', ' + t.alt + ' if an alternate' : ''}</td></tr>
                {t.note ? <tr><td className="mut" style={td}>Note</td><td style={{ color: 'var(--text-warning)', fontStyle: 'italic' }}>{t.note}</td></tr> : null}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

function CohortCompare({ s }) {
  const cs = s.cohorts.filter((c) => cStat(c) === 'open' || avl(s.c)[c.id]);
  const F = [
    ['Type', (c) => s.types[c.t].l],
    ['Nights', (c) => (s.types[c.t].nights ? String(s.types[c.t].nights) : 'Day visit')],
    ['Follow-up', (c) => (c.v.length === 1 ? fmt(c.v[0].d) + ' ±' + c.v[0].w : c.v.length + ' visits to ' + fmt(c.v[c.v.length - 1].d))],
    ['Pays', (c) => s.types[c.t].pay],
    ['Note', (c) => (s.types[c.t].note ? 'Yes' : '-')],
  ];
  const dif = F.map((f) => new Set(cs.map(f[1])).size > 1);
  const line = { fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 4 };
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
        {cs.map((c) => {
          const on = avl(s.c)[c.id], k = cKey(c), K = rk(k);
          return (
            <div key={c.id} style={{ border: on ? '2px solid var(--border-accent)' : '.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 10px', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 500, fontSize: 12 }}>{c.n}</span>
                {S.away.length ? <span className={'pill bdg ' + K[1]}>{K[0]}</span> : null}
              </div>
              <div style={line}><span className="mut">In clinic</span><button className="lnk dif" style={{ fontSize: 11 }} {...A('jump:' + s.c + ':' + c.id)}>{fmtR(c.in, c.out)}</button></div>
              {F.map((f, i) => (
                <div key={f[0]} style={line}><span className="mut">{f[0]}</span><span className={dif[i] ? 'dif' : ''} style={{ textAlign: 'right' }}>{f[1](c)}</span></div>
              ))}
              {k === 'clash' ? <div style={{ fontSize: 11, color: 'var(--text-danger)' }}>Clashes with away dates</div> : k === 'caution' ? <div style={{ fontSize: 11, color: 'var(--text-warning)' }}>Follow-up window partly overlaps away dates</div> : null}
              <button className={'pill wide ' + (on ? 'tag' : '')} {...A('avail:' + s.c + ':' + c.id)} aria-pressed={!!on} style={{ width: '100%', marginTop: 6, cursor: 'pointer' }}>
                {on ? <><Ic n="ti-check" /> Selected</> : 'Select'}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mut" style={{ fontSize: 11, margin: '6px 0 0' }}>Values in blue differ between cohorts. Click a date to see it on the timeline.</p>
    </>
  );
}

function PreQ({ s }) {
  const has = !!s.cohorts, dOk = !has || S.datesOk[s.c], iOk = S.read[s.c], sc = selC(s);
  const tab = (k, l, done) => (
    <button className="pill wide" role="tab" aria-selected={S.sub === k} {...A('sub:' + k)}
      style={{ flex: 1, border: 0, borderBottom: '2px solid ' + (S.sub === k ? 'var(--border-accent)' : 'var(--border)'), borderRadius: 0, color: S.sub === k ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
      {done ? <><Ic n="ti-check" style={{ color: 'var(--text-success)' }} /> </> : null}{l}
    </button>
  );
  return (
    <div className="card">
      <Piece as="p" className="lab">{s.c} · {s.d} · do these in either order</Piece>
      <Piece style={{ display: 'flex', gap: 4 }} role="tablist">{tab('dates', 'Cohorts and dates', dOk)}{tab('info', 'Study information', iOk)}</Piece>
      <Piece>
        {S.sub === 'dates' ? (
          has ? (
            <>
              <p className="mut" style={{ fontSize: 12, margin: '8px 0' }}>Read the dates to them and select each cohort they can make.</p>
              <CohortCompare s={s} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                <button className="pill ib" {...A('plan')} style={{ color: 'var(--text-accent)', paddingLeft: 0 }}><Ic n="ti-calendar-stats" /> Compare with other studies</button>
                <button className={'pill ' + (dOk ? 'ok' : 'pri')} {...A('dok')}>{dOk ? 'Dates confirmed' : 'Dates confirmed with participant'}</button>
              </div>
              <Err msg={S.err.d} />
            </>
          ) : <p className="mut" style={{ fontSize: 12, margin: '8px 0' }}>No cohort schedule loaded for this study in the prototype.</p>
        ) : (
          <>
            <InfoBlock s={s} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className={'pill ' + (iOk ? 'ok' : 'pri')} {...A('read')}>{iOk ? 'Read to participant' : "I've read it to them"}</button>
            </div>
          </>
        )}
      </Piece>
      <Piece style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '.5px solid var(--border)', paddingTop: 10 }}>
        <span className="mut" style={{ fontSize: 12 }}>{sc.length ? 'Selected: ' + sc.map((c) => c.n).join(', ') : has ? 'No cohorts selected' : ''}</span>
        <button className={'pill ' + (dOk && iOk ? 'pri' : '')} {...A('startq')}>Start questions</button>
      </Piece>
      <Err msg={S.err.s} />
    </div>
  );
}

/* ---------------- Question blocks ---------------- */
export function SayBlock({ z, big }) {
  return z.ro ? (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', margin: '6px 0 2px' }}><Ic n="ti-eye-off" /> Recruiter check, don't read out</div>
      <p style={{ fontSize: big ? 15 : 13, fontWeight: 500, margin: 0, lineHeight: 1.45 }}><Emph t={z.t} /></p>
    </>
  ) : (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-accent)', margin: '6px 0 2px' }}><Ic n="ti-microphone" /> Say</div>
      <p style={{ fontFamily: 'var(--font-voice)', fontSize: big ? 17 : 14, lineHeight: 1.5, margin: 0, color: 'var(--text-primary)' }}><Emph t={z.t} nums /></p>
    </>
  );
}

export function NoteBlock({ r, small }) {
  return (
    <div style={{ marginTop: 8, padding: '6px 10px', borderLeft: '3px solid var(--border-warning)', background: 'var(--surface-1)', borderRadius: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-warning)' }}>Recruiter only</div>
      <div style={{ fontSize: small ? 12 : 13, fontStyle: 'italic', lineHeight: 1.55 }}><Emph t={r} /></div>
    </div>
  );
}

function PeekCard({ L, id }) {
  const z = L.find((x) => x.id === id);
  if (!z) return null;
  const n = L.indexOf(z) + 1;
  return (
    <div style={{ border: '1.5px dashed var(--border-accent)', borderRadius: 'var(--radius)', margin: '8px 0', padding: '10px 12px', background: 'var(--surface-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--text-accent)', fontWeight: 500 }}><Ic n="ti-eye" /> Preview</span> · <B>Q{n}</B> · {z.sec} · <i>{S.out[z.id] ? 'answered ' + S.ans[z.id] : 'not asked yet'}</i>
        </span>
        <button className="pill ib" {...A('peek:')} aria-label="Close preview"><Ic n="ti-x" /></button>
      </div>
      <SayBlock z={z} />
      {z.r ? <NoteBlock r={z.r} small /> : null}
      {z.crit ? <div style={{ fontSize: 12, marginTop: 6 }}><span className="mut">Exclusion criteria:</span> {z.crit.join(' · ')}</div> : null}
      <div style={{ fontSize: 12, marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="mut">Answers:</span> {z.a.map((b) => <span key={b[0]} className={'pill bdg ' + ocls(b[1])}>{b[0]}</span>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
        <button className="pill" {...A('peek:')}>Close</button>
        <button className="pill pri" {...A('goq:' + z.id)}>Go to Q{n}</button>
      </div>
    </div>
  );
}

function UpNext({ L, i }) {
  const nx = L.slice(i + 1).filter((z) => !S.out[z.id]).slice(0, 3);
  if (!nx.length) return null;
  return (
    <div style={{ marginTop: 10, borderTop: '.5px solid var(--border)', paddingTop: 4 }}>
      <PanelHead id="upnext" title="Up next" right={S.col.upnext ? null : <span className="mut" style={{ fontSize: 11 }}>click to preview</span>} />
      <Expander open={!S.col.upnext}>
        {nx.map((z) => (
          <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0 2px 22px' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', width: 30 }}>Q{L.indexOf(z) + 1}</span>
            <button className="lnk" {...A('peek:' + z.id)} style={{ textDecoration: 'none', color: 'var(--text-primary)', flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <B>{z.s}</B> <span className="mut">· {short(z.t, 60)}</span>
            </button>
          </div>
        ))}
      </Expander>
    </div>
  );
}

function Extra({ q, s }) {
  const sc = selC(s);
  if (q.dates)
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {sc.length ? sc.map((c) => {
          const k = cKey(c);
          return (
            <span key={c.id} className={'pill ' + (k === 'clash' ? 'bad' : k === 'caution' ? 'warn' : '')} style={{ cursor: 'default' }}>
              <B>{c.n}</B> · <button className="lnk" style={{ color: 'inherit' }} {...A('jump:' + s.c + ':' + c.id)}>{fmtR(c.in, c.out)}</button>, follow-up {c.v.map((v) => fmt(v.d)).join(', ')}
            </span>
          );
        }) : <span style={{ fontSize: 12, color: 'var(--text-warning)' }}>No cohorts selected. Tick the ones they can make above.</span>}
      </div>
    );
  if (q.hol) {
    const r = sc.map(cKey);
    return (
      <div style={{ marginTop: 8, fontSize: 12 }}>
        {S.away.length ? (
          <>
            {S.away.map((a) => (
              <span key={a[0] + a[1]} className="pill bad bdg" style={{ marginRight: 4 }}>Away <button className="lnk" style={{ color: 'inherit' }} {...A('jumpd:' + a[0])}>{fmtR(a[0], a[1])}</button></span>
            ))}
            {r.includes('clash') ? <B style={{ color: 'var(--text-danger)' }}> Clashes with a selected cohort</B>
              : r.includes('caution') ? <B style={{ color: 'var(--text-warning)' }}> Partly overlaps a follow-up window</B>
                : <span style={{ color: 'var(--text-success)' }}> No clash with selected cohorts</span>}
          </>
        ) : <button className="pill" {...A('plan')}><Ic n="ti-calendar-plus" /> Add away dates</button>}
      </div>
    );
  }
  if (q.auto) {
    const a = age(), b = bmi();
    const v = q.auto === 'sex' ? (S.sex ? (S.sex === 'f' ? 'Female' : 'Male') : 'not answered') : q.auto === 'age' ? (a != null ? a + ' yrs' : 'no DOB') : b != null ? S.ht + ' cm, ' + S.wt + ' kg, BMI ' + b : 'not answered';
    return <div className="soft" style={{ marginTop: 8, fontSize: 12 }}><Ic n="ti-arrow-back-up" /> <span className="mut">From Quick Check:</span> <B>{v}</B>. <i>Confirm with them.</i></div>;
  }
  if (q.alc)
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
        <input type="number" inputMode="numeric" aria-label="Drinks a week" value={S.alc} placeholder="Drinks a week" style={{ width: 130 }} onChange={(e) => upd(() => (S.alc = e.target.value))} />
        <span className="mut" style={{ fontSize: 12 }}>Limit <B>{S.sex === 'm' ? 21 : 14}</B> a week</span>
      </div>
    );
  return null;
}

function OneMode({ L, i, q }) {
  const s = S.study, o = S.out[q.id], w = S.why[q.id] || [], sg = sugQ(q);
  const critOpen = !!(S.critOpen || w.length), noteOpen = !!(S.noteOpen || S.note[q.id]);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {q.sec} · <B style={{ color: 'var(--text-primary)', fontSize: 14 }}>Question {i + 1}</B> of {L.length}
          {q.only ? <> · <i style={{ color: 'var(--text-accent)' }}>cohort-specific</i></> : null}
          {q.when ? <> · <span className="pill bdg tag"><Ic n="ti-corner-down-right" /> Follow-up to Q{L.findIndex((z) => z.id === q.when.id) + 1} ({S.ans[q.when.id] || ''})</span></> : null}
        </span>
        {o ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <span className={'pill bdg ' + ocls(o)}>Answered: {S.ans[q.id]}</span>
            <button className="pill ib clr" {...A('clr:' + q.id)} title="Clear this answer"><Ic n="ti-eraser" /> Clear answer</button>
          </span>
        ) : S.park[q.id] ? <span className="pill bdg warn"><Ic n="ti-bookmark" /> Parked</span> : null}
      </div>
      <SayBlock z={q} big />
      <Extra q={q} s={s} />
      {q.r ? <NoteBlock r={q.r} /> : null}
      {q.carry ? <MedLog c={q.carry} /> : null}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {q.crit ? (
          <button className="lnk" {...A('critopen')} aria-expanded={critOpen} style={{ fontSize: 12 }}>
            {critOpen ? 'Hide' : 'Show'} exclusion reasons ({q.crit.length}){w.length ? ' · ' + w.length + ' ticked' : ''}
          </button>
        ) : null}
        <button className="lnk" {...A('noteopen')} aria-expanded={noteOpen} style={{ fontSize: 12 }}>{noteOpen ? 'Hide comment' : 'Add comment'}</button>
      </div>
      <Expander open={!!q.crit && critOpen}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {(q.crit || []).map((c, j) => (
            <button key={c} className={'pill ' + (w.includes(c) ? 'bad' : '')} aria-pressed={w.includes(c)} {...A('crit:' + j)}>
              {w.includes(c) ? <><Ic n="ti-check" /> </> : null}{c}
            </button>
          ))}
        </div>
      </Expander>
      <Expander open={noteOpen}>
        <textarea
          data-f="note" aria-label="Comment for the coordinator" placeholder="Comment for the coordinator. No names, phone numbers or emails"
          style={{ width: '100%', marginTop: 6, minHeight: 36, fontSize: 12, boxSizing: 'border-box' }}
          value={S.note[q.id] || ''} onChange={(e) => upd(() => (S.note[curQ().q.id] = e.target.value))}
        />
      </Expander>
      {S.tips ? <div style={{ fontSize: 11, margin: '10px 0 4px' }} className="mut"><i>Tap an answer, or press its number key</i></div> : <div style={{ height: 10 }} />}
      <div style={{ display: 'flex', gap: 6 }}>
        {q.a.map((b, j) => {
          const isS = sg && ((sg === b[1] && q.a.filter((z) => z[1] === sg)[0] === b) || sg === b[0]);
          const picked = o && S.ans[q.id] === b[0];
          return (
            <button key={b[0]} {...A('ans:' + j)} className={'ans ' + (picked ? ocls(b[1]) : '')} aria-pressed={!!picked}
              style={isS ? { outline: '2px solid var(--border-' + (b[1] === 'x' ? 'danger' : b[1] === 'd' ? 'warning' : 'success') + ')', outlineOffset: 1 } : null}>
              {picked ? <><Ic n="ti-check" /> </> : null}{b[0]}{S.tips ? <span className="k">{j + 1}</span> : null}
              {isS ? <><br /><span style={{ fontSize: 11 }} className="mut">suggested</span></> : null}
            </button>
          );
        })}
      </div>
      <FuHint q={q} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
        <button className="pill ib" {...A('prev')} style={i ? null : { visibility: 'hidden' }}><Ic n="ti-arrow-left" /> Previous</button>
        <span style={{ display: 'flex', gap: 4 }}>
          {o ? null : <button className="pill ib" {...A('park')} title="Mark to come back to"><Ic n="ti-bookmark" /> Park for later</button>}
          <button className="pill ib" {...A('next')} style={i < L.length - 1 ? null : { visibility: 'hidden' }}>Next without answering <Ic n="ti-arrow-right" /></button>
        </span>
      </div>
      {S.focusMode ? null : <UpNext L={L} i={i} />}
    </>
  );
}

function ListMode({ L, q }) {
  const secs = [...new Set(L.map((z) => z.sec))], si = secs.indexOf(q.sec), Z = L.filter((z) => z.sec === q.sec);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 2px' }}>
        <span style={{ fontSize: 17, fontWeight: 500 }}>{q.sec}</span>
        <span style={{ display: 'flex', gap: 4 }}>
          <button className="pill ib" {...A('secstep:-1')} style={si ? null : { visibility: 'hidden' }} aria-label="Previous section"><Ic n="ti-chevron-left" /></button>
          <button className="pill ib" {...A('secstep:1')} style={si < secs.length - 1 ? null : { visibility: 'hidden' }} aria-label="Next section"><Ic n="ti-chevron-right" /></button>
        </span>
      </div>
      {S.tips ? <p style={{ fontSize: 11, margin: '0 0 4px', fontStyle: 'italic' }} className="mut">Answer in any order. The view follows the next question to ask.</p> : null}
      {Z.map((z) => {
        const n = L.indexOf(z) + 1, cur = z.id === q.id, o = S.out[z.id], noteOpen = !!(cur || S.showNote[z.id]);
        return (
          <div key={z.id} id={'qr-' + z.id} className={cur ? 'qcur' : ''}
            style={{ padding: '8px 8px 8px 10px', borderTop: '.5px solid var(--border)', scrollMarginTop: 120, ...(z.when ? { marginLeft: 22, borderLeft: '2px solid var(--border-accent)' } : null) }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 3, width: 28, flexShrink: 0 }}>Q{n}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {cur && !o ? <div className="asknext"><Ic n="ti-arrow-big-right-filled" /> Ask next</div> : null}
                {z.ro ? <div style={{ fontSize: 13, fontWeight: 500 }}><Emph t={z.t} /></div> : <div style={{ fontFamily: 'var(--font-voice)', fontSize: 14, lineHeight: 1.45 }}><Emph t={z.t} nums /></div>}
                {z.r ? (
                  <>
                    {noteOpen ? null : <button className="lnk" {...A('shownote:' + z.id)} style={{ fontSize: 11 }}>Recruiter note</button>}
                    <Expander open={noteOpen}><NoteBlock r={z.r} small /></Expander>
                  </>
                ) : null}
                {z.carry || z.dates || z.hol || z.alc ? (
                  <button className="pill" {...A('goone:' + z.id)} style={{ marginTop: 4, fontSize: 11 }}>
                    <Ic n="ti-arrows-maximize" /> Open full question{z.carry ? ' to log ' + (z.carry === 'hx' ? 'conditions' : 'medications') : ''}
                  </button>
                ) : null}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {z.a.map((b, j) => {
                    const picked = o && S.ans[z.id] === b[0];
                    return (
                      <button key={b[0]} className={'pill ' + (picked ? ocls(b[1]) : '')} aria-pressed={!!picked} {...A('ansl:' + z.id + ':' + j)} style={{ fontSize: 12 }}>
                        {picked ? <><Ic n="ti-check" /> </> : null}{b[0]}
                      </button>
                    );
                  })}
                  {o ? <button className="pill ib clr" {...A('clr:' + z.id)} title="Clear this answer"><Ic n="ti-eraser" /> Clear</button> : null}
                  {needsReview(z) ? <span className="pill bdg warn">Review</span> : null}
                </div>
                {o ? null : <FuHint q={z} />}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Snippet({ z }) {
  const term = S.qs.trim().toLowerCase();
  if (!term) return null;
  const F = [['Say', z.t], ['Note', z.r || ''], ['Criteria', (z.crit || []).join(', ')], ['Answers', z.a.map((a) => a[0]).join(', ')]];
  for (const f of F) {
    const i = f[1].toLowerCase().indexOf(term);
    if (i >= 0 && (f[0] !== 'Say' || z.t.length > 70)) {
      const a = Math.max(0, i - 30), b = Math.min(f[1].length, i + term.length + 40);
      return <div style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 52 }}><i>{f[0]}:</i> {a ? '…' : ''}<Hl t={f[1].slice(a, b)} />{b < f[1].length ? '…' : ''}</div>;
    }
  }
  return null;
}

function QMapList() {
  const { L, q } = curQ(), term = S.qs.trim().toLowerCase();
  const m = (z) => !term || (z.t + ' ' + (z.r || '') + ' ' + (z.crit || []).join(' ') + ' ' + z.s + ' ' + z.a.map((a) => a[0]).join(' ') + ' ' + z.sec).toLowerCase().includes(term);
  const hits = L.filter(m);
  if (!hits.length) return <p className="mut" style={{ fontSize: 12, margin: '4px 0', fontStyle: 'italic' }}>No questions match "{S.qs}".</p>;
  const secs = [...new Set(hits.map((z) => z.sec))];
  return (
    <>
      {term ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }} aria-live="polite">{hits.length} of {L.length} questions match</div> : null}
      {secs.map((sn) => (
        <div key={sn}>
          <div style={{ fontSize: 12, fontWeight: 500, margin: '6px 0 2px', color: 'var(--text-primary)' }}>{sn}</div>
          {hits.filter((z) => z.sec === sn).map((z) => {
            const n = L.indexOf(z) + 1, o = S.out[z.id], cur = z.id === q.id, rv = needsReview(z);
            return (
              <div key={z.id} style={{ padding: '2px 4px', borderRadius: 4, ...(z.when ? { marginLeft: 18 } : null), background: cur ? 'var(--bg-accent)' : S.peek === z.id ? 'var(--surface-2)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="dot" style={{ margin: 0, background: o ? 'var(--fill-' + oc(o) + ')' : 'transparent', border: '1px solid ' + (o ? 'transparent' : 'var(--border-stronger)') }} />
                  <span className="mono" style={{ fontSize: 11, width: 30, color: 'var(--text-secondary)' }}>{z.when ? '↳' : ''}Q{n}</span>
                  <button className="lnk" {...A('peek:' + z.id)} title="Preview" style={{ textDecoration: 'none', color: 'var(--text-primary)', flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Hl t={z.s} /> <span className="mut">· <Hl t={short(z.t, 60)} /></span>
                  </button>
                  {rv ? <span className="pill bdg warn">Review</span> : null}
                  {S.park[z.id] && !o ? <Ic n="ti-bookmark" style={{ color: 'var(--text-warning)' }} label="Parked" /> : null}
                  {o ? <span style={{ fontSize: 11, color: 'var(--text-' + oc(o) + ')', whiteSpace: 'nowrap' }}>{S.ans[z.id]}</span> : null}
                  {cur ? <span className="pill tag" style={{ padding: '0 5px' }}>Now</span> : <button className="pill ib" {...A('goq:' + z.id)} aria-label={'Go to Q' + n} style={{ padding: '0 4px' }}><Ic n="ti-arrow-right" /></button>}
                </div>
                <Snippet z={z} />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ---------------- Undo ---------------- */
function UndoBar({ last, floating, onEnter, onLeave }) {
  return (
    <div className={'undo ' + ocls(last.o || 'n') + (floating ? ' fl' : '')} role="status" onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
      <Ic n="ti-circle-check" />
      <span style={{ flex: 1, minWidth: 0 }}>{last.label}{last.moved ? <span style={{ opacity: 0.8 }}> · {last.moved}</span> : null}</span>
      <button className="pill undob" {...A('undo')} title="Undo this answer (U)"><Ic n="ti-arrow-back-up" /> Undo <span className="k">U</span></button>
    </div>
  );
}

/**
 * Floating undo toast for the section list. Rises 16px in 240ms, leaves the same way in 170ms.
 * Stays 12s (an action toast stays at least 5s); the timer pauses while hovered or focused.
 */
function UndoToast({ last }) {
  const [gone, setGone] = useState(false);
  const left = useRef(12000), started = useRef(0), timer = useRef(null);
  const run = () => { started.current = performance.now(); timer.current = setTimeout(() => setGone(true), left.current); };
  const pause = () => { clearTimeout(timer.current); left.current = Math.max(0, left.current - (performance.now() - started.current)); };
  useEffect(() => {
    setGone(false); left.current = 12000;
    if (last) run();
    return () => clearTimeout(timer.current);
  }, [last]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = !!last && !gone;
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="toast"
          style={{ position: 'fixed', zIndex: 20, left: 0, right: 0, bottom: 18, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}
          initial={quiet() ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: tr(DUR.toastIn) }}
          exit={{ opacity: 0, y: 16, transition: tr(DUR.toastOut, 'in') }}
        >
          <div style={{ pointerEvents: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.2)', borderRadius: 'var(--radius)', minWidth: 340, maxWidth: '92vw' }}>
            <UndoBar last={last} onEnter={pause} onLeave={run} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ---------------- Pre-screen ---------------- */
export function PreScreen() {
  const s = S.study;
  const peekId = useLatest(S.peek);
  if (!s) return <div className="card mut">Pick a study from Pivotable studies to start.</div>;
  if (!S.qon) return <PreQ s={s} />;
  const { L, i, q } = curQ();
  if (!q) return <div className="card">No questions.</div>;
  const done = L.filter((z) => S.out[z.id]).length, fr = frontier(L), rev = L.filter(needsReview), pk = L.filter((z) => S.park[z.id] && !S.out[z.id]);
  const secs = [...new Set(L.map((z) => z.sec))];
  const open = (s.cohorts || []).filter((c) => cStat(c) === 'open' || avl(s.c)[c.id]);
  const back = S.nav.length ? L.findIndex((z) => z.id === S.nav[S.nav.length - 1]) : -1;
  const showUndo = !!(S.last && S.last.next === q.id);
  const mapOpen = !!(S.mapOpen || S.qs.trim());

  return (
    <div className="card">
      <Piece style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 150 }}>
          <Ic n="ti-search" style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
          <input type="search" id="qSearch" data-f="qs" aria-label="Search questions" placeholder="Search questions, e.g. tyramine" value={S.qs}
            style={{ paddingLeft: 28, height: 30, fontSize: 12, width: '100%', boxSizing: 'border-box' }} onChange={(e) => upd(() => (S.qs = e.target.value))} />
        </div>
        <button className={'pill ' + (S.mapOpen ? 'tag' : '')} {...A('map')} aria-expanded={mapOpen} style={{ cursor: 'pointer' }}><Ic n="ti-list-tree" /> All {L.length}</button>
        <span className="seg" role="tablist">
          <button role="tab" aria-selected={S.mode === 'one'} {...A('mode:one')} className={S.mode === 'one' ? 'sel' : ''}>One at a time</button>
          <button role="tab" aria-selected={S.mode === 'list'} {...A('mode:list')} className={S.mode === 'list' ? 'sel' : ''}>Section list</button>
        </span>
      </Piece>
      <Expander open={mapOpen}>
        <Resizable id="qmap" style={{ ...(S.sz.qmap ? null : S.qs.trim() ? { maxHeight: 260 } : { height: 220 }), padding: '4px 8px', marginTop: 6, background: 'var(--surface-1)', borderRadius: 'var(--radius)' }}>
          {mapOpen ? <QMapList /> : null}
        </Resizable>
      </Expander>
      <Piece>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0 6px' }}>
          {secs.map((sn) => {
            const Z = L.filter((z) => z.sec === sn), n = Z.filter((z) => S.out[z.id]).length, cur = q.sec === sn;
            const flag = Z.some((z) => S.out[z.id] === 'x') ? 'bad' : Z.some((z) => S.out[z.id] === 'd') ? 'warn' : '';
            return (
              <button key={sn} className={'pill ' + (cur ? 'tag' : flag)} aria-current={cur ? 'true' : undefined} {...A('sec:' + encodeURIComponent(sn))} style={{ cursor: 'pointer', fontSize: 11 }}>
                {sn} <B style={{ fontVariantNumeric: 'tabular-nums' }}>{n}/{Z.length}</B>
              </button>
            );
          })}
        </div>
        {/* Progress fill grows from its last value with scaleX, never width */}
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }} role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={L.length} aria-valuenow={done}>
          <motion.div style={{ height: 4, background: 'var(--fill-accent)', transformOrigin: 'left center' }} initial={false} animate={{ scaleX: done / L.length }} transition={tr(DUR.move, 'io')} />
        </div>
      </Piece>
      {s.cohorts && !S.focusMode ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 6 }}>
            <span className="mut" style={{ fontSize: 11 }}>Cohorts:</span>
            {open.map((c) => (
              <button key={c.id} className={'pill ' + (avl(s.c)[c.id] ? 'tag' : '')} aria-pressed={!!avl(s.c)[c.id]} {...A('avail:' + s.c + ':' + c.id)} style={{ cursor: 'pointer', fontSize: 11, padding: '1px 7px' }}>
                {avl(s.c)[c.id] ? <><Ic n="ti-check" /> </> : null}{c.n}
              </button>
            ))}
            <button className="pill ib" {...A('info')} aria-expanded={S.infoOpen} style={{ fontSize: 11, color: 'var(--text-accent)' }}>{S.infoOpen ? 'Hide study info' : 'Study info'}</button>
          </div>
          <Expander open={S.infoOpen}><div className="soft" style={{ marginBottom: 8 }}><InfoBlock s={s} /></div></Expander>
        </>
      ) : null}
      {rev.length ? (
        <div style={{ fontSize: 12, marginBottom: 6, padding: '6px 10px', borderLeft: '3px solid var(--border-warning)', background: 'var(--surface-1)', borderRadius: 0 }}>
          <B style={{ color: 'var(--text-warning)' }}>{rev.length} answer{rev.length > 1 ? 's' : ''} may need another look</B> <i className="mut">because of information added later:</i>{' '}
          {rev.map((z, k) => <span key={z.id}>{k ? ', ' : ''}<button className="lnk" {...A('goq:' + z.id)}>Q{L.indexOf(z) + 1} {z.s}</button></span>)}
        </div>
      ) : null}
      {pk.length ? (
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          <Ic n="ti-bookmark" style={{ color: 'var(--text-warning)' }} /> <B>Parked:</B>{' '}
          {pk.map((z, k) => <span key={z.id}>{k ? ', ' : ''}<button className="lnk" {...A('goq:' + z.id)}>Q{L.indexOf(z) + 1} {z.s}</button></span>)}
        </div>
      ) : null}
      {back >= 0 || (fr && fr.id !== q.id && S.out[q.id]) ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          {back >= 0 ? <button className="pill" {...A('navback')}><Ic n="ti-arrow-back-up" /> Back to Q{back + 1}</button> : null}
          {fr && fr.id !== q.id && S.out[q.id] ? <button className="pill" {...A('goq:' + fr.id)}>Continue from Q{L.indexOf(fr) + 1} <Ic n="ti-arrow-right" /></button> : null}
        </div>
      ) : null}
      {S.mode === 'list' ? <UndoToast last={showUndo ? S.last : null} /> : showUndo ? <UndoBar last={S.last} /> : null}
      <Expander open={!!S.peek}><PeekCard L={L} id={peekId} /></Expander>
      <Piece>{S.mode === 'list' ? <ListMode L={L} q={q} /> : <OneMode L={L} i={i} q={q} />}</Piece>
    </div>
  );
}
