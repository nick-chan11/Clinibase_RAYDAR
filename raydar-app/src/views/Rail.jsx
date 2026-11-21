import { AnimatePresence } from 'motion/react';
import { S, upd, ranked, nextOpen, fmt, matchP, proS, proFor, COL, TXT } from '../engine/store.js';
import { ST } from '../esource/studies.js';
import { A, Ic, B, Panel } from './ui.jsx';
import { Row } from '../motion/components.jsx';
import { LogPanelBody, ProRows } from './MedLog.jsx';

/**
 * Pivotable studies. When Quick check answers rule a study out, it moves down the list:
 * rows reorder with a layout (FLIP) transform on the ease-in-out curve instead of jumping.
 */
export function Studies() {
  const r = ranked(), n = (k) => r.filter((x) => x.r[0] === k).length;
  const inPs = S.study && (S.stage === 'ps' || S.stage === 'finish');
  let L;
  if (S.all) L = r;
  else if (inPs) L = [r.find((x) => x.s.c === S.study.c)].concat(r.filter((x) => x.s.c !== S.study.c && x.r[0] !== 'no').slice(0, 2));
  else L = r.slice(0, 3);
  const sub = <><span style={{ color: 'var(--text-success)' }}>{n('yes')}</span> · <span style={{ color: 'var(--text-warning)' }}>{n('check')}</span> · {n('no')}</>;
  return (
    <Panel id="stud" title="Pivotable studies" sub={sub}>
      <div style={{ position: 'relative' }}>
        <AnimatePresence initial={false} mode="popLayout">
          {L.map((x, i) => {
            const cur = inPs && x.s.c === S.study.c, no = nextOpen(x.s);
            return (
              <Row key={x.s.c} i={i} className="row" style={{ padding: '5px 0', background: 'var(--surface-2)' }} title={x.s.d + ' · ' + x.s.site}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontWeight: 500 }}><span className="dot" style={{ background: COL[x.r[0]] }} />{x.s.c} <span className="mut" style={{ fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 11 }}>{x.s.site}</span></div>
                  <div style={{ fontSize: 11, color: TXT[x.r[0]], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.r[1]}</div>
                  {no ? <div className="mut" style={{ fontSize: 11 }}>Next stay <button className="lnk" style={{ fontSize: 11 }} {...A('jump:' + x.s.c + ':' + no.id)}>{fmt(no.in)}</button></div> : null}
                </div>
                {cur ? <span className="pill tag">Screening</span> : (
                  <button className="pill" style={{ fontSize: 11 }} {...A('start:' + x.s.c)}>{x.r[0] === 'no' ? 'View' : inPs ? 'Switch' : 'Start'}</button>
                )}
              </Row>
            );
          })}
        </AnimatePresence>
      </div>
      <button className="pill wide" {...A('all')} aria-expanded={S.all} style={{ marginTop: 4, width: '100%', fontSize: 11 }}>{S.all ? 'Show fewer' : 'Show all ' + r.length}</button>
    </Panel>
  );
}

export function LogPanel() {
  const cnt = (x) => S.log.filter((e) => e.t === x).length;
  return (
    <Panel id="log" title="Meds and history" sub={cnt('med') + ' meds · ' + cnt('otc') + ' OTC · ' + cnt('hx') + ' hx'} rs>
      <LogPanelBody />
    </Panel>
  );
}

export function ProPanel() {
  const code = proS(), hits = S.log.map((e) => ({ e, p: matchP(e, code) })).filter((z) => z.p && z.p.o !== 'ok');
  const P = proFor(code), total = (P.med || []).length + (P.hx || []).length;
  return (
    <Panel
      id="pro" title="Prohibited list" rs
      sub={hits.length ? <B style={{ color: 'var(--text-danger)' }}>{hits.length} match{hits.length > 1 ? 'es' : ''}</B> : ''}
      right={
        <select aria-label="Study" value={code} onChange={(e) => upd(() => (S.proS = e.target.value))} style={{ height: 26, fontSize: 11, width: 'auto', maxWidth: 120, padding: '0 4px' }}>
          {ST.map((x) => <option key={x.c}>{x.c}</option>)}
        </select>
      }
    >
      {!total ? <p className="mut" style={{ fontSize: 12, margin: 0, fontStyle: 'italic' }}>No prohibited list for {code} is loaded in RAYDAR yet. The eSource's medication questions and study notes still apply.</p> : hits.length ? hits.map((z, i) => (
        <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>
          <span className={'pill bdg ' + (z.p.o === 'x' ? 'bad' : 'warn')}>{z.p.o === 'x' ? 'Prohibited' : 'Doctor'}</span> <B>{z.e.n}</B> <span className="mut">· {z.p.n}</span>
        </div>
      )) : <p className="mut" style={{ fontSize: 12, margin: 0, fontStyle: 'italic' }}>No logged items match this study's list.</p>}
      {total ? <><input type="search" aria-label="Search meds or conditions" placeholder="Search meds or conditions" value={S.rq} style={{ marginTop: 8, height: 30, fontSize: 12, width: '100%', boxSizing: 'border-box' }} onChange={(e) => upd(() => (S.rq = e.target.value))} />
      <div>{S.rq.trim() || S.proAll ? <ProRows Pl={P} types={['med', 'hx']} q={S.rq} limit={0} /> : null}</div>
      <button className="pill wide" {...A('proall')} aria-expanded={S.proAll} style={{ marginTop: 6, width: '100%', fontSize: 11 }}>{S.proAll ? 'Hide full list' : 'Browse full list (' + total + ')'}</button></> : null}
    </Panel>
  );
}
