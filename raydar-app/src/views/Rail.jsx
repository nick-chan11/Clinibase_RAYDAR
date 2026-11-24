import { AnimatePresence } from 'motion/react';
import { S, SITE, upd, ranked, nextOpen, fmt, matchP, proS, proFor, siteOk, ev, COL, TXT } from '../engine/store.js';
import { HtmlBlocks } from './ui.jsx';
import { ST } from '../esource/studies.js';
import { A, Ic, B, Panel } from './ui.jsx';
import { Row } from '../motion/components.jsx';
import { LogPanelBody, ProRows } from './MedLog.jsx';

/**
 * Pivotable studies. When Quick check answers rule a study out, it moves down the list:
 * rows reorder with a layout (FLIP) transform on the ease-in-out curve instead of jumping.
 */
export function Studies() {
  const r = ranked(S.railAll), n = (k) => r.filter((x) => x.r[0] === k).length;
  const inPs = S.study && (S.stage === 'ps' || S.stage === 'finish');
  // 2.7: the study on screen stays at the top even when the site filter hides it (switching city mid-call used to crash here)
  const me = inPs ? r.find((x) => x.s.c === S.study.c) || { s: S.study, r: ev(S.study), off: true } : null;
  let L;
  if (S.all) L = me && me.off ? [me].concat(r) : r;
  else if (inPs) L = [me].concat(r.filter((x) => x.s.c !== S.study.c && x.r[0] !== 'no').slice(0, 2));
  else L = r.slice(0, 3);
  const sub = <><span style={{ color: 'var(--text-success)' }}>{n('yes')}</span> · <span style={{ color: 'var(--text-warning)' }}>{n('check')}</span> · {n('no')}</>;
  return (
    <Panel id="stud" title="Pivotable studies" sub={sub} right={SITE.city !== 'all' || Object.values(SITE.off).some(Boolean) ? (
      <button className={'pill ' + (S.railAll ? 'tag' : '')} {...A('railall')} aria-pressed={S.railAll} style={{ fontSize: 11, cursor: 'pointer' }} title="Show every site here, whatever the header says">{S.railAll ? 'All sites' : 'Header site'}</button>
    ) : null}>
      <div style={{ position: 'relative' }}>
        <AnimatePresence initial={false} mode="popLayout">
          {L.map((x, i) => {
            const cur = inPs && x.s.c === S.study.c, no = nextOpen(x.s);
            return (
              <Row key={x.s.c} i={i} className="row" style={{ padding: '5px 0', background: 'var(--surface-2)' }} title={x.s.d + ' · ' + x.s.site}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontWeight: 500 }}><span className="dot" style={{ background: COL[x.r[0]] }} />{x.s.c} <span className={'sitetag site-' + x.s.city + (x.s.site === 'Veritus' ? '-v' : '')}>{x.s.siteLabel}</span>{x.off ? <span className="mut" style={{ fontSize: 11 }}> · outside the site filter</span> : null}</div>
                  <div style={{ fontSize: 11, color: TXT[x.r[0]], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.r[1]}</div>
                  {no ? <div className="mut" style={{ fontSize: 11 }}>{x.s.sched ? 'Earliest Day 1' : 'Next stay'} <button className="lnk" style={{ fontSize: 11 }} {...A('jump:' + x.s.c + ':' + no.id)}>{fmt(no.in)}</button></div> : null}
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
  const st = ST.find((x) => x.c === code), P = proFor(code), notes = (st && st.proNotes) || { med: [], hx: [] };
  const tab = S.proTab === 'hx' ? 'hx' : 'med', total = (P.med || []).length + (P.hx || []).length;
  const shown = ST.filter((x) => siteOk(x) || x.c === code);
  return (
    <Panel
      id="pro" title="Prohibited list" rs
      sub={hits.length ? <B style={{ color: 'var(--text-danger)' }}>{hits.length} possible match{hits.length > 1 ? 'es' : ''}</B> : ''}
      right={
        <select aria-label="Study" value={code} onChange={(e) => upd(() => (S.proS = e.target.value))} style={{ height: 26, fontSize: 11, width: 'auto', maxWidth: 140, padding: '0 4px' }}>
          {shown.map((x) => <option key={x.c}>{x.c}</option>)}
        </select>
      }
    >
      {hits.length ? hits.map((z, i) => (
        <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>
          <span className={'pill bdg ' + (z.p.o === 'x' ? 'bad' : 'warn')}>{z.p.o === 'x' ? 'On the list' : 'Doctor'}</span> <B>{z.e.n}</B> <span className="mut">· {z.p.n}</span>
        </div>
      )) : null}
      {!total ? (
        <p className="mut" style={{ fontSize: 12, margin: 0, fontStyle: 'italic' }}>RAYDAR found no prohibited list in {code}'s eSource. Its medication questions and study notes still apply.</p>
      ) : (
        <>
          <div className="seg" style={{ display: 'flex', margin: '6px 0' }}>
            <button style={{ flex: 1 }} className={tab === 'med' ? 'sel' : ''} onClick={() => upd(() => (S.proTab = 'med'))}>Medications ({(P.med || []).length})</button>
            <button style={{ flex: 1 }} className={tab === 'hx' ? 'sel' : ''} onClick={() => upd(() => (S.proTab = 'hx'))}>Conditions ({(P.hx || []).length})</button>
          </div>
          <input type="search" aria-label="Search the list" placeholder={tab === 'med' ? 'Search, e.g. gliptin' : 'Search, e.g. thyroid'} value={S.rq} style={{ height: 30, fontSize: 12, width: '100%', boxSizing: 'border-box' }} onChange={(e) => upd(() => (S.rq = e.target.value))} />
          {S.rq.trim() ? <ProRows Pl={P} types={[tab]} q={S.rq} limit={0} /> : (
            <div style={{ marginTop: 6 }}>
              {(notes[tab] || []).map((n) => (
                <div key={n.name} style={{ marginBottom: 8 }}>
                  <div className="mut" style={{ fontSize: 11, marginBottom: 2 }}>From the eSource: {n.title}</div>
                  <HtmlBlocks blocks={[n]} style={{ fontSize: 12 }} />
                </div>
              ))}
              {!(notes[tab] || []).length ? <p className="mut" style={{ fontSize: 12, fontStyle: 'italic' }}>No {tab === 'med' ? 'medication' : 'condition'} list found in this eSource.</p> : null}
            </div>
          )}
          <p className="mut" style={{ fontSize: 11, margin: '4px 0 0' }}>{tab === 'med' ? 'Logged medications are checked against these by drug name. A match is a prompt to check, not an answer.' : 'Conditions are listed for reference; RAYDAR does not match them automatically.'}</p>
        </>
      )}
    </Panel>
  );
}
