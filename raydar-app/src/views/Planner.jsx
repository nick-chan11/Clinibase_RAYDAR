import { useLayoutEffect, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { prefersReduced } from '../motion/tokens.js';
import {
  S, upd, act, ZP, tlB, planStudies, pShown, ev, cStat, cKey, rk, avl, SC, dd, add, DD, TODAY, COL,
  vS, vE, vStat, stayHit, fmtR, cn, tipStay, tipVisit, tipCohort, tipAway,
} from '../engine/store.js';
import { A, Ic, Panel } from './ui.jsx';
import { Row } from '../motion/components.jsx';

const kColor = (k) => (k === 'ok' ? 'var(--text-success)' : k === 'caution' ? 'var(--text-warning)' : k === 'clash' ? 'var(--text-danger)' : 'var(--text-secondary)');

function Timeline({ shown, z, B, X }) {
  const W = B.days * z;
  const sc = useRef(null), mountedBefore = useRef(false);
  // Jumping to a date glides when the timeline is already on screen; it lands directly when it is just opening or zooming
  useLayoutEffect(() => {
    const el = sc.current;
    if (!el) return;
    if (S.jumpTo) {
      const tx = Math.max(0, dd(B.start, S.jumpTo) * z - 80);
      if (S.jumpSmooth && mountedBefore.current && !prefersReduced()) el.scrollTo({ left: tx, behavior: 'smooth' });
      else el.scrollLeft = tx;
      S.sx = tx;
      S.jumpTo = null;
    } else if (!mountedBefore.current) el.scrollLeft = S.sx || 0;
    S.jumpSmooth = false;
    mountedBefore.current = true;
  });
  const rows = [];
  shown.forEach((s) => {
    rows.push({ h: 1, s });
    const cs = s.cohorts.filter((c) => !S.hideClosed || cStat(c) === 'open');
    if (!cs.length) rows.push({ e: 1, s });
    cs.forEach((c) => rows.push({ s, c }));
  });
  const RH = (r) => (r.h ? 26 : r.e ? 22 : 38);
  const ticks = [], grid = [];
  for (let d = B.start; d <= B.end; d = add(d, 1)) {
    const D = DD(d);
    if (D.getDate() === 1) {
      grid.push(<div key={'g' + d} style={{ position: 'absolute', top: 0, bottom: 0, left: X(d), borderLeft: '1px solid var(--border-strong)' }} />);
      ticks.push(<span key={'m' + d} style={{ position: 'absolute', left: X(d) + 3, top: 0, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{D.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</span>);
    }
    if (z > 8 && D.getDay() === 1)
      ticks.push(<span key={'w' + d} style={{ position: 'absolute', left: X(d), top: 15, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border)', paddingLeft: 2 }}>{D.getDate()}</span>);
  }
  const labels = [<div key="hd" style={{ height: 32, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-end', paddingBottom: 3 }}>Cohort</div>];
  const tracks = [];
  rows.forEach((r, ri) => {
    const h = RH(r);
    if (r.h) {
      const e = ev(r.s);
      labels.push(
        <div key={'h' + ri} style={{ height: h, display: 'flex', alignItems: 'center', gap: 4, borderTop: '.5px solid var(--border-strong)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span className="dot" style={{ background: COL[e[0]], margin: 0 }} /><span className="mono" style={{ fontWeight: 500 }}>{r.s.c}</span>
          {r.s.sample ? <span className="mut" style={{ fontSize: 11 }}>sample</span> : null}
        </div>
      );
      tracks.push(<div key={'h' + ri} style={{ height: h, borderTop: '.5px solid var(--border-strong)' }} />);
      return;
    }
    if (r.e) {
      labels.push(<div key={'e' + ri} style={{ height: h, fontSize: 11 }} className="mut">No open cohorts</div>);
      tracks.push(<div key={'e' + ri} style={{ height: h }} />);
      return;
    }
    const { c, s } = r, k = cKey(c), K = rk(k), on = avl(s.c)[c.id], sel = S.psel && S.psel[0] === s.c && S.psel[1] === c.id, ty = s.types[c.t];
    const closed = k === 'closed' || k === 'soon';
    labels.push(
      <div key={s.c + c.id} role="button" tabIndex={0} {...A('psel:' + s.c + ':' + c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act('psel:' + s.c + ':' + c.id); } }}
        style={{ height: h, cursor: 'pointer', overflow: 'hidden', lineHeight: 1.3, paddingTop: 3, background: sel ? 'var(--bg-accent)' : undefined }}>
        <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{on ? <><Ic n="ti-user-check" style={{ color: 'var(--text-accent)' }} /> </> : null}{c.n}</div>
        <div style={{ fontSize: 11, whiteSpace: 'nowrap' }}><span style={{ color: kColor(k), fontWeight: 500 }}>{K[0]}</span> <span className="mut">· {ty.nights ? ty.nights + ' nights' : 'day visit'}</span></div>
      </div>
    );
    tracks.push(
      <div key={s.c + c.id} style={{ height: h, position: 'relative', background: sel ? 'var(--bg-accent)' : undefined }}>
        <div {...A('psel:' + s.c + ':' + c.id)} data-tip={tipStay(s, c)}
          style={{ position: 'absolute', top: 9, height: 18, left: X(c.in), width: Math.max(4, (dd(c.in, c.out) + 1) * z), background: K[2], border: closed ? '1.5px dashed var(--border-stronger)' : '1.5px solid var(--text-primary)', borderRadius: 3, cursor: 'pointer', boxSizing: 'border-box', ...(on ? { outline: '2px solid var(--text-accent)', outlineOffset: 2 } : null) }} />
        {c.v.map((v) => {
          const vs = vStat(v), col = closed ? 'var(--border-stronger)' : vs === 'clash' ? 'var(--fill-danger)' : vs === 'caution' ? 'var(--fill-warning)' : 'var(--text-primary)';
          return (
            <span key={v.d + v.l}>
              <div data-tip={tipVisit(s, c, v)} style={{ position: 'absolute', top: 14, height: 8, backgroundClip: 'content-box', padding: '2px 0', boxSizing: 'border-box', left: X(vS(v)), width: (dd(vS(v), vE(v)) + 1) * z, background: col, borderRadius: 2 }} />
              <div {...A('jumpd:' + v.d)} data-tip={tipVisit(s, c, v)} style={{ position: 'absolute', top: 12, width: 12, height: 12, borderRadius: '50%', left: X(v.d) + z / 2 - 6, background: col, border: '2px solid var(--surface-2)', boxSizing: 'border-box', cursor: 'pointer' }} />
            </span>
          );
        })}
      </div>
    );
  });
  return (
    <div style={{ display: 'flex', marginTop: 10, border: '.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div style={{ width: 150, flexShrink: 0, padding: '0 6px', borderRight: '.5px solid var(--border-strong)' }}>{labels}</div>
      <div id="tlScroll" ref={sc} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }} onScroll={(e) => (S.sx = e.currentTarget.scrollLeft)}>
        <div id="tlIn" style={{ width: W, position: 'relative' }}>
          <div style={{ height: 32, position: 'relative' }}>{ticks}</div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              {grid}
              {S.away.map((a) => (
                <div key={'a' + a[0]} style={{ position: 'absolute', top: 0, bottom: 0, left: X(a[0]), width: (dd(a[0], a[1]) + 1) * z, background: 'var(--bg-danger)', borderLeft: '1.5px solid var(--fill-danger)', borderRight: '1.5px solid var(--fill-danger)' }} />
              ))}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: X(TODAY), borderLeft: '2px solid var(--text-accent)' }} />
            </div>
            <div style={{ position: 'relative' }}>{tracks}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail() {
  const s = SC(S.psel[0]), c = s.cohorts.find((z) => z.id === S.psel[1]), ty = s.types[c.t], on = avl(s.c)[c.id], st = cStat(c);
  const vrow = (key, l, d1, d2, k) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '2px 0' }}>
      <span>{l} <button className="lnk" {...A('jumpd:' + d1)}>{fmtR(d1, d2)}</button></span>
      {k ? <span className={'pill bdg ' + rk(k)[1]}>{rk(k)[0]}</span> : null}
    </div>
  );
  return (
    <div className="soft" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500, fontSize: 12 }}>{s.c} · {c.n} <span className="mut" style={{ fontWeight: 400 }}>{ty.l}, {ty.pay}</span></span>
        <span style={{ display: 'flex', gap: 6 }}>
          {st === 'open' ? <button className="pill" {...A('avail:' + s.c + ':' + c.id)}>{on ? 'Unselect' : 'Select for participant'}</button> : null}
          {st === 'open' && (!S.study || S.study.c !== s.c || S.stage !== 'ps') ? <button className="pill pri" {...A('pstart:' + s.c + ':' + c.id)}>Pre-screen for this</button> : null}
        </span>
      </div>
      {vrow('stay', 'In clinic', c.in, c.out, st === 'open' ? (stayHit(c) ? 'clash' : 'ok') : null)}
      {c.v.map((v) => vrow(v.d + v.l, v.l, vS(v), vE(v), st === 'open' ? vStat(v) : null))}
      {ty.note ? <div className="mut" style={{ fontSize: 11 }}>{ty.note}</div> : null}
    </div>
  );
}

export function Planner() {
  const z = ZP(), B = tlB(), X = (d) => dd(B.start, d) * z;
  const studies = planStudies(), shown = studies.filter(pShown);
  const cats = { ok: [], caution: [], clash: [] };
  shown.forEach((s) => s.cohorts.forEach((c) => { const k = cKey(c); if (cats[k]) cats[k].push({ s, c }); }));
  const keys = S.away.length ? ['ok', 'caution', 'clash'] : ['ok'];
  const close = <button className="pill ib" {...A('plan')} aria-label="Close"><Ic n="ti-x" /></button>;
  const ctl = (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="seg">
        <button {...A('zoom:near')} className={S.zoom === 'near' ? 'sel' : ''}>Weeks</button>
        <button {...A('zoom:far')} className={S.zoom === 'far' ? 'sel' : ''}>Months</button>
      </span>
      <button className="pill" {...A('resetview')}><Ic n="ti-arrow-back-up" /> Reset view</button>
      {close}
    </span>
  );
  const sw = (bg, extra) => <span className="sw" style={{ background: bg, ...extra }} />;
  return (
    <Panel id="plan" title="Compare dates across studies" right={S.col.plan ? close : ctl} rs style={{ marginTop: 10 }}>
      {S.tips ? (
        <div className="guide" style={{ margin: '0 0 8px' }}>
          <Ic n="ti-bulb" />
          <span style={{ flex: 1 }}><b>1</b> Add their away dates <Ic n="ti-arrow-right" /> <b>2</b> Cohorts sort into Available, Caution and Clash <Ic n="ti-arrow-right" /> <b>3</b> Click a cohort to jump to it. Hover any bar or dot for its dates.</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 8px', alignItems: 'center' }}>
        <span className="mut" style={{ fontSize: 12 }}>Comparing:</span>
        {studies.map((s) => {
          const on = pShown(s), r = ev(s);
          return (
            <button key={s.c} className={'pill ' + (on ? 'tag' : '')} aria-pressed={on} {...A('pshow:' + s.c)} style={{ cursor: 'pointer' }}>
              {on ? <><Ic n="ti-check" /> </> : null}<span className="dot" style={{ background: COL[r[0]] }} />{s.c}
            </button>
          );
        })}
        <button className="pill ib" {...A('pclear')} style={{ color: 'var(--text-danger)' }}>Clear studies</button>
        <button className="pill ib" {...A('pdefault')} style={{ color: 'var(--text-accent)' }}>Show matches</button>
        <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
          <input type="checkbox" checked={S.hideClosed} onChange={(e) => upd(() => (S.hideClosed = e.target.checked))} /> Hide closed
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-end' }}>
        <div><span className="fl">Participant away from</span><input type="date" aria-label="Participant away from" value={S.awF} style={{ width: 140 }} onChange={(e) => upd(() => (S.awF = e.target.value))} /></div>
        <div><span className="fl">Until (optional)</span><input type="date" aria-label="Away until" value={S.awT} min={S.awF || undefined} style={{ width: 140 }} onChange={(e) => upd(() => (S.awT = e.target.value))} /></div>
        <button className="pill" {...A('awadd')} disabled={!S.awF} title={S.awF ? undefined : 'Pick a start date first'} style={{ height: 30 }}>Add away dates</button>
        <AnimatePresence initial={false} mode="popLayout">
          {S.away.map((a, i) => (
            <Row as="span" key={a[0] + '_' + a[1]} className="pill bad bdg" style={{ padding: '3px 6px', cursor: 'help' }} data-tip={tipAway(a)}>
              <button className="lnk" style={{ color: 'inherit' }} {...A('jumpd:' + a[0])}>{fmtR(a[0], a[1])}</button>{' '}
              <button className="pill ib" {...A('awdel:' + i)} aria-label="Remove away dates" style={{ padding: '0 2px', color: 'inherit' }}><Ic n="ti-x" /></button>
            </Row>
          ))}
        </AnimatePresence>
      </div>
      {shown.length ? (
        <div className="cgrid">
          {keys.map((k) => {
            const K = rk(k), L = cats[k];
            return (
              <div className="cgrp" key={k}>
                <div className="cgh"><span className="dot" style={{ background: K[2], margin: 0 }} />{S.away.length ? K[0] : 'Open cohorts'} <span className="n">{L.length}</span></div>
                <div className="cgb">
                  {L.length ? L.map((x) => {
                    const sel = S.psel && S.psel[0] === x.s.c && S.psel[1] === x.c.id, on = avl(x.s.c)[x.c.id];
                    return (
                      <button key={x.s.c + x.c.id} className={'cchip ' + K[1] + (sel ? ' sel' : '')} {...A('jump:' + x.s.c + ':' + x.c.id)} data-tip={tipCohort(x.s, x.c)}>
                        <span className="cs">{x.s.c.split('-')[0]}</span>{cn(x.c.n)}{on ? <Ic n="ti-user-check" /> : null}
                      </button>
                    );
                  }) : <span className="mut" style={{ fontSize: 11, fontStyle: 'italic' }}>None</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {shown.length ? <Timeline shown={shown} z={z} B={B} X={X} /> : <p className="mut" style={{ fontSize: 12, margin: '10px 0 0' }}>No studies selected. Click a study above to compare it.</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11 }} className="mut">
        <span>{sw('var(--fill-success)', { border: '1.5px solid var(--text-primary)' })}Available</span>
        <span data-tip={'Caution\nA follow-up window partly overlaps away dates. Check with the team.'} style={{ cursor: 'help' }}>{sw('var(--fill-warning)', { border: '1.5px solid var(--text-primary)' })}Caution</span>
        <span data-tip={'Clash\nThe stay, or a whole follow-up window, overlaps away dates.'} style={{ cursor: 'help' }}>{sw('var(--fill-danger)', { border: '1.5px solid var(--text-primary)' })}Clash</span>
        <span>{sw('var(--surface-1)', { border: '1.5px dashed var(--border-stronger)' })}Closed</span>
        <span>{sw('var(--bg-danger)', { borderLeft: '1.5px solid var(--fill-danger)', borderRight: '1.5px solid var(--fill-danger)' })}Away</span>
        <span>{sw('var(--text-accent)', { width: 3 })}Today</span>
        <span>Bar = stay · dot = follow-up</span>
      </div>
      {S.psel ? <Detail /> : null}
    </Panel>
  );
}
