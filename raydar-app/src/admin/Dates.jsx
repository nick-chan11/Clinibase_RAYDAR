/* Dates and visits: fixed cohorts (RAYDAR cohort dates.json) or a rolling schedule (RAYDAR visit schedules.json).
   Dates are never invented: RAYDAR suggests them from a study-notes sentence and the admin confirms each one. */
import { W, edit, draftStudy } from './ws.js';
import { nameParts } from '../esource/convert.js';
import { planWith, earliestScreen, winText } from '../esource/schedule.js';
import { DATE_RE } from '../esource/diff.js';
import { VisitTrack } from '../views/Timeline.jsx';
import { Seg } from './AdminApp.jsx';
import { TextBox } from './TextBox.jsx';

const Ic = ({ n }) => <i className={'ti ' + n} aria-hidden="true" />;
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const nights = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'study';

/** Dates written in a sentence ("from the 3rd - 11th of December", "Monday the 30th of November"), in order. The
    study notes don't give years: late in the year means this year, earlier months next year. */
export function datesIn(sentence) {
  const now = new Date(), out = [];
  const yearFor = (m) => (m >= now.getMonth() - 1 ? now.getFullYear() : now.getFullYear() + 1);
  const mk = (d, m) => { const y = yearFor(m); const dt = new Date(Date.UTC(y, m, d)); return dt.getUTCMonth() === m ? iso(dt) : null; };
  const s = String(sentence);
  const re = /(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:-|–|to|and)\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi;
  let m;
  while ((m = re.exec(s))) {
    const mo = MON.indexOf(m[3].toLowerCase().slice(0, 3));
    const a = mk(+m[1], mo); if (a) out.push(a);
    if (m[2]) { const b = mk(+m[2], mo); if (b) out.push(b); }
  }
  return out;
}

export function DatesTab({ b }) {
  const { site, code } = nameParts(b.file, b.esource);
  const mode = b.dates ? 'fixed' : b.schedule ? 'rolling' : 'none';
  const s = draftStudy(b);
  const lines = (s.notes || []).flatMap((n) => n.blocks.flatMap((x) => String(x.html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').split('\n'))).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && DATE_RE.test(l));
  const setMode = (m) => {
    if (m === mode) return;
    if ((mode === 'fixed' && b.dates.cohorts.length) || (mode === 'rolling' && b.schedule.value.visits.length > 2)) { if (!window.confirm('Switching throws away the dates entered here. Carry on?')) return; }
    edit((x) => {
      x.dates = m === 'fixed' ? { types: { stay: { l: 'Stay', nights: 0, stay: '', fu: '', pay: '' } }, cohorts: [] } : null;
      x.schedule = m === 'rolling' ? { key: slug(code), value: { label: code + ' — ' + (x.esource.title || '').replace(/\s*pre-?screening.*$/i, ''), screenMinToD1: 1, screenMaxToD1: 28, anchor: 'Day 1', note: '', visits: [{ name: 'Screening', dayFrom: -28, dayTo: -1, type: 'clinic' }, { name: 'Day 1', day: 1, win: 0, type: 'clinic' }] }, codes: [code] } : null;
    });
  };
  return (
    <div className="ad-page ad-dates">
      <div className="ad-row">
        <b>How this study books</b>
        <Seg val={mode} set={setMode} label="How this study books" opts={[['fixed', 'Fixed dates (cohorts)'], ['rolling', 'Rolling, from the screening date'], ['none', 'No dates']]} />
      </div>
      <p className="ad-mut ad-small">Fixed: everyone starts on set days (V175, CORSERA, EQ). Rolling: Day 1 follows screening (Emeritus studies such as EMBOLD and SRSD).{mode === 'rolling' && !/emeritus/i.test(site) ? ' RAYDAR only uses rolling schedules for Emeritus studies.' : ''}</p>
      <div className="ad-dgrid">
        <div>
          {mode === 'fixed' ? <Fixed b={b} lines={lines} /> : mode === 'rolling' ? <Rolling b={b} /> : <div className="ad-card"><p>No dates. Recruiters see no cohorts or visit timeline for this study.</p>{lines.length ? <p className="ad-msg warn">The study notes mention dates, so it probably needs some. See them on the right.</p> : null}</div>}
        </div>
        <div>
          {mode === 'rolling' ? <RollingPreview b={b} site={site} /> : null}
          <div className="ad-card">
            <h3>Date sentences in the study notes</h3>
            {lines.length ? lines.slice(0, 30).map((l, i) => <p key={i} className="ad-quote">{l}</p>) : <p className="ad-mut">None found.</p>}
            <p className="ad-mut ad-small">Each cohort keeps the sentence its dates came from. Use the sentence buttons on a cohort to copy one in and get suggested dates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fixed({ b, lines }) {
  const d = b.dates;
  const typeKeys = Object.keys(d.types || {});
  const upd = (fn) => edit((x) => fn(x.dates));
  return (
    <>
      <div className="ad-card">
        <h3>Kinds of stay</h3>
        {typeKeys.map((k) => {
          const t = d.types[k];
          return (
            <div key={k} className="ad-typerow">
              <label className="ad-field">Name <input value={t.l || ''} onChange={(e) => upd((x) => { x.types[k].l = e.target.value; })} /></label>
              <label className="ad-field sm">Nights <input type="number" min="0" value={t.nights ?? 0} onChange={(e) => upd((x) => { x.types[k].nights = +e.target.value; })} /></label>
              <label className="ad-field">The stay <input value={t.stay || ''} onChange={(e) => upd((x) => { x.types[k].stay = e.target.value; })} placeholder="e.g. 8 nights, Day -1 to Day 8" /></label>
              <label className="ad-field">Follow-ups <input value={t.fu || ''} onChange={(e) => upd((x) => { x.types[k].fu = e.target.value; })} /></label>
              <label className="ad-field sm">Payment <input value={t.pay || ''} onChange={(e) => upd((x) => { x.types[k].pay = e.target.value; })} /></label>
              {typeKeys.length > 1 ? <button className="ad-x" aria-label="Remove this kind" onClick={() => upd((x) => { delete x.types[k]; })}><Ic n="ti-x" /></button> : null}
            </div>
          );
        })}
        <button className="ad-link" onClick={() => upd((x) => { let n = 1; while (x.types['stay' + n]) n++; x.types['stay' + n] = { l: 'Stay ' + (n + 1), nights: 0, stay: '', fu: '', pay: '' }; })}>+ Another kind of stay</button>
        <p className="ad-mut ad-small">A day-visit study (no overnight stay, like V175-001) has 0 nights: check-in and check-out are the same day.</p>
      </div>
      {d.cohorts.map((c, i) => <Cohort key={i} c={c} i={i} d={d} lines={lines} upd={upd} />)}
      <button className="ad-btn" onClick={() => upd((x) => { x.cohorts.push({ id: 'c' + (x.cohorts.length + 1), n: 'Cohort ' + (x.cohorts.length + 1), t: typeKeys[0], in: '', out: '', v: [], src: '' }); })}><Ic n="ti-plus" /> Add a cohort</button>
    </>
  );
}

function Cohort({ c, i, d, lines, upd }) {
  const t = d.types[c.t] || {};
  const set = (fn) => upd((x) => fn(x.cohorts[i]));
  const probs = [];
  if (!c.in || !c.out) probs.push('Needs check-in and check-out dates');
  else {
    if (c.out < c.in) probs.push('Checks out before checking in');
    if (t.nights === 0 && c.in !== c.out) probs.push('A day visit (0 nights) checks in and out on the same day');
    if (t.nights > 0 && nights(c.in, c.out) !== t.nights && !/separate|stays\b/i.test(t.stay || '')) probs.push('The kind of stay says ' + t.nights + ' nights; these dates give ' + nights(c.in, c.out));
  }
  if (!c.src || c.src.trim().length < 10) probs.push('Copy in the study-notes sentence these dates come from');
  const d1 = c.d1 || c.in;
  const suggest = (line) => {
    const ds = datesIn(line);
    set((x) => { x.src = line; if (ds.length && !x.in) { x.in = ds[0]; x.out = (d.types[x.t] || {}).nights === 0 ? ds[0] : ds[1] || ds[0]; } });
  };
  return (
    <div className="ad-card ad-cohort">
      <div className="ad-row">
        <label className="ad-field">Cohort name <input value={c.n} onChange={(e) => set((x) => { x.n = e.target.value; })} /></label>
        <button className="ad-x" aria-label="Remove this cohort" onClick={() => { if (window.confirm('Remove ' + c.n + '?')) upd((x) => x.cohorts.splice(i, 1)); }}><Ic n="ti-trash" /></button>
      </div>
      <div className="ad-row">
        <label className="ad-field sm">Kind <select value={c.t} onChange={(e) => set((x) => { x.t = e.target.value; })}>{Object.entries(d.types).map(([k, v]) => <option key={k} value={k}>{v.l || k}</option>)}</select></label>
        <label className="ad-field sm">{t.nights === 0 ? 'Day 1' : 'Check in'} <input type="date" value={c.in} onChange={(e) => set((x) => { x.in = e.target.value; if (t.nights === 0) x.out = e.target.value; else if (t.nights > 0 && e.target.value) x.out = addDays(e.target.value, t.nights); })} /></label>
        {t.nights === 0 ? null : <label className="ad-field sm">Check out <input type="date" value={c.out} onChange={(e) => set((x) => { x.out = e.target.value; })} /></label>}
        <label className="ad-check"><input type="checkbox" checked={!!c.closed} onChange={(e) => set((x) => { if (e.target.checked) x.closed = true; else delete x.closed; })} /> Filled</label>
      </div>
      <label className="ad-field">From the study notes (required)
        <textarea rows={2} value={c.src || ''} onChange={(e) => set((x) => { x.src = e.target.value; })} placeholder="The sentence these dates come from, exactly as written" />
      </label>
      {lines.length ? <div className="ad-sugg"><span className="ad-mut ad-small">Use a sentence:</span>{lines.slice(0, 8).map((l, k) => <button key={k} className="ad-btn sm ghost" title={l} onClick={() => suggest(l)}>{l.slice(0, 44)}{l.length > 44 ? '…' : ''}</button>)}</div> : null}
      <div className="ad-visits">
        <div className="ad-vh"><span>Follow-up visit</span><span>Study day</span><span>Date</span><span>Window ± days</span><span /></div>
        {(c.v || []).map((v, k) => (
          <div key={k} className="ad-vr">
            <input aria-label="Visit name" value={v.l || ''} onChange={(e) => set((x) => { x.v[k].l = e.target.value; })} placeholder="e.g. Day 8 visit" />
            <input aria-label="Study day" type="number" value={v.day ?? ''} placeholder="—" onChange={(e) => set((x) => { const n = e.target.value === '' ? undefined : +e.target.value; x.v[k].day = n; if (n !== undefined && d1) x.v[k].d = addDays(d1, n > 0 ? n - 1 : n); })} title="Day N counts from Day 1: Day N = Day 1 + (N - 1) days" />
            <input aria-label="Date" type="date" value={v.d || ''} onChange={(e) => set((x) => { x.v[k].d = e.target.value; delete x.v[k].day; })} />
            <input aria-label="Window" type="number" min="0" value={v.w ?? 0} onChange={(e) => set((x) => { x.v[k].w = +e.target.value; })} />
            <button className="ad-x" aria-label="Remove this visit" onClick={() => set((x) => x.v.splice(k, 1))}><Ic n="ti-x" /></button>
          </div>
        ))}
        <button className="ad-link" onClick={() => set((x) => { (x.v = x.v || []).push({ l: '', d: '', w: 0 }); })}>+ Add a follow-up visit</button>
        <span className="ad-mut ad-small">Type a study day and the date works itself out from Day 1 ({d1 || 'set it above'}). Phone or telehealth calls need no clinic day, so leave them out.</span>
      </div>
      {probs.length ? <ul className="ad-probs">{probs.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="ad-ok"><Ic n="ti-check" /> Looks right</p>}
    </div>
  );
}

function Rolling({ b }) {
  const s = b.schedule.value;
  const set = (fn) => edit((x) => fn(x.schedule));
  return (
    <div className="ad-card">
      <div className="ad-row">
        <label className="ad-field">Name <input value={s.label || ''} onChange={(e) => set((x) => { x.value.label = e.target.value; })} /></label>
        <label className="ad-field sm">Day 1 from <input type="number" value={s.screenMinToD1} onChange={(e) => set((x) => { x.value.screenMinToD1 = +e.target.value; })} /></label>
        <label className="ad-field sm">to <input type="number" value={s.screenMaxToD1} onChange={(e) => set((x) => { x.value.screenMaxToD1 = +e.target.value; })} /></label>
        <span className="ad-mut ad-small">days after screening</span>
      </div>
      <label className="ad-field">Source and notes <input value={s.note || ''} onChange={(e) => set((x) => { x.value.note = e.target.value; })} placeholder="e.g. Protocol v2.0, schedule of activities, Table 1" /></label>
      <label className="ad-field">Study codes that use this schedule <TextBox value={(b.schedule.codes || []).join(', ')} onChange={(v) => set((x) => { x.codes = v.split(',').map((c) => c.trim()).filter(Boolean); })} /></label>
      <div className="ad-visits">
        <div className="ad-vh roll"><span>Visit</span><span>Study day</span><span>Window ±</span><span>Type</span><span /></div>
        {s.visits.map((v, k) => (
          <div key={k} className="ad-vr roll">
            <input aria-label="Visit name" value={v.name} onChange={(e) => set((x) => { x.value.visits[k].name = e.target.value; })} />
            {v.dayFrom !== undefined
              ? <TextBox aria-label="Days" value={v.dayFrom + ' to ' + v.dayTo} onChange={(t) => { const m = /(-?\d+)\s*to\s*(-?\d+)/.exec(t); if (m) set((x) => { x.value.visits[k].dayFrom = +m[1]; x.value.visits[k].dayTo = +m[2]; }); }} />
              : <input aria-label="Study day" type="number" value={v.day} onChange={(e) => set((x) => { x.value.visits[k].day = +e.target.value; })} />}
            <input aria-label="Window" type="number" min="0" value={v.dayFrom !== undefined ? '' : v.win || 0} disabled={v.dayFrom !== undefined} onChange={(e) => set((x) => { x.value.visits[k].win = +e.target.value; })} />
            <select aria-label="Type" value={v.type} onChange={(e) => set((x) => { x.value.visits[k].type = e.target.value; })}><option value="clinic">Clinic</option><option value="phone">Phone</option><option value="remote">Remote</option></select>
            <button className="ad-x" aria-label="Remove this visit" onClick={() => set((x) => x.value.visits.splice(k, 1))}><Ic n="ti-x" /></button>
          </div>
        ))}
        <button className="ad-link" onClick={() => set((x) => { const last = x.value.visits[x.value.visits.length - 1]; x.value.visits.push({ name: 'Day ' + ((last && last.day) || 1), day: (last && last.day) || 1, win: 0, type: 'clinic' }); })}>+ Add a visit</button>
        <span className="ad-mut ad-small">Day 1 is the anchor. Phone visits need no open clinic day. {s.visits.length} visits: {s.visits.slice(0, 6).map((v) => (v.dayFrom !== undefined ? 'screening' : 'D' + v.day + (winText(v) !== 'exact' ? ' ' + winText(v) : ''))).join(', ')}{s.visits.length > 6 ? '…' : ''}</span>
      </div>
    </div>
  );
}

function RollingPreview({ b, site }) {
  const P = planWith(b.schedule.value, earliestScreen(site), site, [], null);
  return (
    <div className="ad-card">
      <h3>What recruiters will see</h3>
      <p className="ad-mut ad-small">With the earliest screening date ({earliestScreen(site)}) and no away dates.</p>
      {P ? <VisitTrack P={P} /> : <p className="ad-mut">Add visits to see the timeline.</p>}
    </div>
  );
}
