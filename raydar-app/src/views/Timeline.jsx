import { useEffect, useRef, useState } from 'react';
import { S, upd, act, emPlan, fmtR, tipAway } from '../engine/store.js';
import { earliestScreen, iso, winText } from '../esource/schedule.js';
import { A, Ic, B } from './ui.jsx';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (d) => DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
const span = (a, b) => (iso(a) === iso(b) ? day(a) : a.getMonth() === b.getMonth() ? a.getDate() + '-' + b.getDate() + ' ' + MON[a.getMonth()] : a.getDate() + ' ' + MON[a.getMonth()] + '-' + b.getDate() + ' ' + MON[b.getMonth()]) + (b.getFullYear() !== new Date().getFullYear() ? ' ' + b.getFullYear() : '');
const COLOUR = { free: 'var(--fill-success)', part: 'var(--fill-warning)', clash: 'var(--fill-danger)', phone: 'var(--border-stronger)' };
const WORD = { free: 'Free', part: 'Partly unavailable, still attendable', clash: 'Clash: no open day in the window', phone: 'Phone call' };

/**
 * 2.6: a rolling-recruitment (Emeritus) study's visits mapped from the screening date, the way RAYDAR Original's
 * Visit calculator does it. Weekends, the site's public holidays and the participant's away dates are closed days.
 */
export function VisitTimeline({ s }) {
  const P = emPlan(s);
  if (!P) return <p className="mut" style={{ fontSize: 12 }}>No visit schedule is loaded for this study.</p>;
  const scr = S.scr || earliestScreen(s.site), min = earliestScreen(s.site);
  const head = P.screenClosed
    ? ['bad', 'The screening date is closed (' + (P.screenClosed === 'away' ? 'they are away' : P.screenClosed === 'weekend' ? 'a weekend' : P.screenClosed) + ')', 'Pick another screening date.']
    : P.level === 'ok' ? ['ok', 'Good fit: every visit can be attended', P.okD.length + ' of the ' + P.d1s.length + ' possible Day 1 dates work.']
      : P.level === 'warn' ? ['warn', 'At risk: only ' + P.okD.length + ' of the ' + P.d1s.length + ' possible Day 1 dates fit', 'Book Day 1 in one of the ranges below, or move screening later.']
        : ['bad', 'Not a fit from this screening date', 'No Day 1 lets them attend every visit. Try a later screening date, or check their away dates.'];
  return (
    <div className="vt" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
      <div className="mut" style={{ fontSize: 12 }}>{P.sched.label} · {s.siteLabel} · Day 1 can fall {P.sched.screenMinToD1} to {P.sched.screenMaxToD1} days after screening. Weekends and {/sydney/i.test(s.site) ? 'NSW' : 'Victoria'} public holidays are closed days.</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, fontWeight: 600 }}>Screening date
          <input type="date" value={scr} min={min} style={{ height: 32, fontSize: 13 }} onChange={(e) => act('scr:' + e.target.value)} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, fontWeight: 600 }}>Away
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontWeight: 400 }}>
            {S.away.map((a, i) => (
              <span key={a[0] + a[1]} className="pill bad bdg" style={{ padding: '3px 8px' }} data-tip={tipAway(a)}>{fmtR(a[0], a[1])} <button className="pill ib" {...A('awdel:' + i)} aria-label="Remove away dates" style={{ padding: '0 2px', color: 'inherit' }}><Ic n="ti-x" /></button></span>
            ))}
            <input type="date" aria-label="Away from" value={S.awF} style={{ height: 30, width: 136 }} onChange={(e) => upd(() => (S.awF = e.target.value))} />
            <input type="date" aria-label="Away until" value={S.awT} min={S.awF || undefined} style={{ height: 30, width: 136 }} onChange={(e) => upd(() => (S.awT = e.target.value))} />
            <button className="pill" {...A('awadd')} disabled={!S.awF} style={{ height: 30 }}>Add</button>
          </span>
        </div>
        <span className="mut" style={{ fontSize: 12, paddingBottom: 6 }}>Earliest screening: {day(new Date(min + 'T12:00:00'))} (48 hours' notice)</span>
      </div>

      <div className={'pill ' + head[0]} role="status" style={{ display: 'block', padding: '10px 12px', borderRadius: 10, cursor: 'default' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{head[1]}</div>
        <div style={{ fontSize: 13, marginTop: 2, color: 'var(--text-primary)' }}>{head[2]}</div>
      </div>

      {P.okD.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
          <span className="mut">Day 1 that works:</span>
          {P.okD.slice(0, 16).map((d) => (
            <button key={iso(d)} className={'pill ' + (iso(d) === iso(P.D1) ? 'tag' : '')} aria-pressed={iso(d) === iso(P.D1)} {...A('d1:' + iso(d))} style={{ cursor: 'pointer', fontSize: 12 }}>{day(d)}</button>
          ))}
          {P.okD.length > 16 ? <span className="mut">+{P.okD.length - 16} more</span> : null}
        </div>
      ) : null}

      <VisitTrack P={P} />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }} className="mut">
        {['free', 'part', 'clash', 'phone'].map((k) => <span key={k}><span className="dot" style={{ background: COLOUR[k] }} />{WORD[k]}</span>)}
        <span><span className="dot" style={{ background: 'var(--bg-danger)', outline: '1px solid var(--border-danger)' }} />Away</span>
        <span>Bar = the visit's window</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600 }}>Visits if Day 1 is {day(P.D1)}</div>
      <div className="vt-tablewrap">
      <table>
        <thead><tr><th>Visit</th><th>Day</th><th>Window</th><th>Dates</th><th>Status</th></tr></thead>
        <tbody>
          {P.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.v.name}</td>
              <td>{r.v.day !== undefined ? r.v.day : r.v.dayFrom + ' to ' + r.v.dayTo}</td>
              <td>{r.screen ? '' : winText(r.v)}</td>
              <td>{r.screen ? day(P.S) : span(r.from, r.to)}</td>
              <td style={{ color: r.status === 'free' ? 'var(--text-success)' : r.status === 'part' ? 'var(--text-warning)' : r.status === 'clash' ? 'var(--text-danger)' : 'var(--text-secondary)' }}>
                {r.status === 'part' ? r.note + ' in window' : r.status === 'clash' ? (r.note ? r.note : WORD.clash) : WORD[r.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {P.sched.note ? <p className="mut" style={{ fontSize: 11, margin: 0 }}>Schedule: {P.sched.note}</p> : null}
    </div>
  );
}

/**
 * 2.7: the visits on a timeline you scroll sideways, at a readable scale (it was squeezed into the card's width, so a
 * year-long study like EMBOLD was a row of overlapping dots). Weeks view: about a week per 50px, with visit labels;
 * Whole study fits it all in. Each visit is a bar across its window, phone calls sit on their own lane.
 */
export function VisitTrack({ P }) {
  const [zoom, setZoom] = useState('weeks');
  const box = useRef(null);
  const DAY = 864e5, t0 = P.S.getTime() - 3 * DAY, t1 = Math.max(...P.rows.map((r) => r.to.getTime()), t0 + 30 * DAY) + 10 * DAY;
  const days = Math.round((t1 - t0) / DAY);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const ppd = zoom === 'weeks' ? 7 : Math.max(0.6, (w - 16) / days);
  const width = Math.max(w - 2, Math.round(days * ppd));
  const X = (d) => Math.round(((d.getTime() - t0) / DAY) * ppd);
  useEffect(() => { if (box.current) box.current.scrollLeft = 0; }, [zoom, P.S.getTime()]);
  const months = [];
  for (let d = new Date(new Date(t0).getFullYear(), new Date(t0).getMonth() + 1, 1, 12); d.getTime() <= t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) months.push(d);
  // label every month when there's room, otherwise every 2nd, 3rd or 6th; the year shows when it changes
  const step = [1, 2, 3, 6].find((k) => 30.4 * ppd * k >= 66) || 12;
  const weeks = [];
  if (zoom === 'weeks') for (let d = new Date(t0 + ((8 - new Date(t0).getDay()) % 7) * DAY); d.getTime() <= t1; d = new Date(d.getTime() + 7 * DAY)) weeks.push(d);
  const clinic = P.rows.filter((r) => r.status !== 'phone'), phone = P.rows.filter((r) => r.status === 'phone');
  // labels alternate between two lines when visits sit close together
  const lab = (r) => (r.screen ? 'Screening' : r.v.day !== undefined ? 'D' + r.v.day : r.v.name);
  let lastX = -1e9, row = 0;
  const placed = clinic.map((r) => { const x = X(r.from); row = x - lastX < 46 ? 1 - row : 0; lastX = x; return { r, x, row }; });
  const H = 150;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
        <span className="seg" role="tablist" aria-label="Timeline zoom">
          <button role="tab" aria-selected={zoom === 'weeks'} className={zoom === 'weeks' ? 'sel' : ''} onClick={() => setZoom('weeks')}>Weeks</button>
          <button role="tab" aria-selected={zoom === 'all'} className={zoom === 'all' ? 'sel' : ''} onClick={() => setZoom('all')}>Whole study</button>
        </span>
        <span className="mut">{zoom === 'weeks' ? 'Scroll sideways (or Shift + scroll) to follow the study. ' : ''}{P.rows.length} visits over {Math.round(days / 30.4)} months</span>
      </div>
      <div className="vt-scroll" ref={box} tabIndex={0} aria-label="Visit timeline, scrolls sideways">
        <div className="vt-canvas" style={{ width, height: H }}>
          {S.away.map((a) => {
            const A0 = new Date(a[0] + 'T12:00:00'), A1 = new Date((a[1] || a[0]) + 'T12:00:00');
            if (A1.getTime() < t0 || A0.getTime() > t1) return null;
            return <div key={'aw' + a[0]} className="vt-away" title={'Away ' + fmtR(a[0], a[1])} style={{ left: X(A0), width: Math.max(3, X(A1) - X(A0) + ppd) }} />;
          })}
          {weeks.map((d) => <div key={'w' + d.getTime()} className="vt-week" style={{ left: X(d) }} />)}
          {months.map((m, i) => {
            const show = i % step === 0, prev = months[i - step];
            return (
              <div key={'m' + m.getTime()} className="vt-month" style={{ left: X(m) }}>
                {show ? <span>{MON[m.getMonth()]}{!prev || prev.getFullYear() !== m.getFullYear() ? ' ' + m.getFullYear() : ''}</span> : null}
              </div>
            );
          })}
          <div className="vt-axis" style={{ top: 70 }} />
          {placed.map(({ r, x, row: rw }, i) => {
            const wd = Math.max(10, X(r.to) - X(r.from) + ppd), c = r.screen ? 'var(--fill-accent)' : COLOUR[r.status];
            return (
              <div key={'c' + i} title={r.v.name + ': ' + span(r.from, r.to) + (r.status === 'part' || r.status === 'clash' ? ' (' + (r.note || WORD[r.status]) + ')' : '')}>
                <div className="vt-bar" style={{ left: x, width: wd, top: 64, background: c }} />
                {zoom === 'weeks' || clinic.length < 14 ? <span className="vt-lab" style={{ left: x, top: rw ? 28 : 44, color: c === COLOUR.free ? 'var(--text-primary)' : c }}>{lab(r)}</span> : null}
              </div>
            );
          })}
          {phone.map((r, i) => <div key={'p' + i} className="vt-phone" title={r.v.name + ': ' + span(r.from, r.to)} style={{ left: X(r.from), width: Math.max(8, X(r.to) - X(r.from) + ppd), top: 90 }} />)}
          {phone.length ? <span className="vt-lane" style={{ top: 100 }}>Phone calls</span> : null}
        </div>
      </div>
    </div>
  );
}
