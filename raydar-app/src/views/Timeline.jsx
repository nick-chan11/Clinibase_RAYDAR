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
  // the track: from the screening date to the end of the last visit window
  const t0 = P.S.getTime(), t1 = Math.max(...P.rows.map((r) => r.to.getTime()), t0 + 864e5);
  const X = (d) => ((d.getTime() - t0) / (t1 - t0)) * 100 + '%';
  const months = [];
  for (let d = new Date(P.S.getFullYear(), P.S.getMonth() + 1, 1, 12); d.getTime() <= t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) months.push(d);
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

      <div className="vt-track" aria-hidden="true">
        <div style={{ position: 'absolute', left: 0, right: 0, top: 46, height: 2, background: 'var(--border-strong)' }} />
        {S.away.map((a) => {
          const A0 = new Date(a[0] + 'T12:00:00'), A1 = new Date((a[1] || a[0]) + 'T12:00:00');
          if (A1.getTime() < t0 || A0.getTime() > t1) return null;
          return <div key={'aw' + a[0]} title={'Away ' + fmtR(a[0], a[1])} style={{ position: 'absolute', left: X(A0 < P.S ? P.S : A0), width: 'calc(' + X(A1) + ' - ' + X(A0 < P.S ? P.S : A0) + ' + 3px)', top: 30, height: 34, background: 'var(--bg-danger)', border: '1px solid var(--border-danger)', borderRadius: 4 }} />;
        })}
        {P.rows.map((r, i) => <div key={i} className="vt-dot" title={r.v.name + ': ' + span(r.from, r.to)} style={{ left: X(r.from), background: r.screen ? 'var(--fill-accent)' : COLOUR[r.status] }} />)}
        {months.map((m) => <span key={iso(m)} style={{ position: 'absolute', left: X(m), top: 70, fontSize: 11, color: 'var(--text-secondary)', borderLeft: '1px solid var(--border)', paddingLeft: 3 }}>{MON[m.getMonth()]}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }} className="mut">
        {['free', 'part', 'clash'].map((k) => <span key={k}><span className="dot" style={{ background: COLOUR[k] }} />{WORD[k]}</span>)}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600 }}>Visits if Day 1 is {day(P.D1)}</div>
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
      {P.sched.note ? <p className="mut" style={{ fontSize: 11, margin: 0 }}>Schedule: {P.sched.note}</p> : null}
    </div>
  );
}
