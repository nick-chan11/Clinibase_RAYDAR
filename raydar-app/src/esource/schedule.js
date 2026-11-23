/* Rolling-recruitment visit timelines (RAYDAR 2.6), for Emeritus studies.
   Schedules come from "RAYDAR visit schedules.json", copied unchanged from RAYDAR Original's Visit calculator.
   The method is the original's: try every Day 1 the protocol allows after the screening date; a Day 1 works when
   every clinic visit still has an open day in its window. Closed days are weekends, the site's public holidays
   and the participant's away dates (2.6: weekends are closed at every clinic). Phone visits don't need an open day. */
import DATA from '../../../RAYDAR visit schedules.json';

export const SCHEDULES = DATA.schedules;
const CODES = Object.entries(DATA.byCode).map(([code, key]) => [code.toUpperCase(), key]);

/** The schedule for a study code from an eSource file name, e.g. "OLX" → OLX72021-02, "SELENE 1 (D8750C00014)" → D8750C00014. */
export function scheduleKeyFor(code) {
  const c = String(code || '').toUpperCase().trim();
  if (c.length < 3) return null;
  const hit = CODES.find(([k]) => c.includes(k)) || CODES.find(([k]) => k.startsWith(c));
  return hit ? hit[1] : null;
}

export const holidaysFor = (site) => (/sydney/i.test(site || '') ? DATA.holidays.sydney : DATA.holidays.melbourne);

/* ---- dates at local noon, so daylight saving never shifts a day ---- */
const at = (s) => new Date(s + 'T12:00:00');
export const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
const dayOffset = (day) => (day > 0 ? day - 1 : day); // Day 1 is the anchor; there is no Day 0
const vOff = (v, f) => { const o = f === 'day' ? v.off : f === 'dayFrom' ? v.offFrom : v.offTo; return o !== undefined ? o : dayOffset(v[f]); };

export function visitWindow(v, D1) {
  if (v.dayFrom !== undefined) {
    if (v.dayTo <= 0) return null; // the screening visit: its date is the one typed in
    return [addDays(D1, vOff(v, 'dayFrom')), addDays(D1, vOff(v, 'dayTo'))];
  }
  const off = vOff(v, 'day'), b = v.win || 0, a = v.winAfter !== undefined ? v.winAfter : v.win || 0;
  return [addDays(D1, off - b), addDays(D1, off + a)];
}

/** What makes a day closed: weekend, public holiday or away. */
export function closedDays(site, away) {
  const hol = holidaysFor(site).days;
  const aw = new Set();
  (away || []).forEach(([a, b]) => { for (let d = at(a), e = at(b || a), n = 0; d <= e && n < 3700; d = addDays(d, 1), n++) aw.add(iso(d)); });
  const why = (d) => { const k = iso(d), w = d.getDay(); return aw.has(k) ? 'away' : hol[k] ? hol[k] : w === 0 || w === 6 ? 'weekend' : ''; };
  return { why, closed: (d) => !!why(d), holName: (d) => hol[iso(d)] || '', away: (d) => aw.has(iso(d)) };
}

function openIn(c, a, b) { for (let d = a; d <= b; d = addDays(d, 1)) if (!c.closed(d)) return true; return false; }

/**
 * The whole picture for one study, screening date and set of away dates.
 * @returns {{S, d1s, okD, ranges, level, D1, rows, screenClosed}}
 */
export function plan(key, screen, site, away, pickD1) {
  const sched = SCHEDULES[key];
  if (!sched || !screen) return null;
  const S = at(screen), c = closedDays(site, away);
  // Day 1 is itself a visit, so only open days can be Day 1
  const d1s = [];
  for (let n = sched.screenMinToD1; n <= sched.screenMaxToD1; n++) { const D = addDays(S, n); if (!c.closed(D)) d1s.push(D); }
  const okD = d1s.filter((D) => sched.visits.every((v) => {
    if (v.type === 'phone') return true;
    const w = visitWindow(v, D);
    return !w || openIn(c, w[0], w[1]);
  }));
  const ranges = [];
  okD.forEach((D) => { const r = ranges[ranges.length - 1]; if (r && (D - r[1]) / 864e5 <= 3 && okD.includes(D)) r[1] = D; else ranges.push([D, D]); });
  const screenClosed = c.why(S);
  const level = screenClosed || !okD.length ? 'bad' : okD.length >= d1s.length / 2 ? 'ok' : 'warn';
  const want = pickD1 && at(pickD1);
  const D1 = (want && d1s.find((d) => iso(d) === iso(want))) || okD[0] || d1s[0] || addDays(S, sched.screenMinToD1);
  const rows = sched.visits.map((v) => {
    const w = visitWindow(v, D1);
    if (!w) return { v, screen: true, from: S, to: S, status: screenClosed ? 'clash' : 'free', note: screenClosed && screenClosed !== 'weekend' ? screenClosed : screenClosed ? 'Weekend' : '' };
    if (v.type === 'phone') return { v, from: w[0], to: w[1], status: 'phone', note: 'Phone call' };
    const notes = new Set();
    let open = 0, hit = false;
    for (let d = w[0]; d <= w[1]; d = addDays(d, 1)) {
      const y = c.why(d);
      if (!y) open++;
      else if (y !== 'weekend') { hit = true; notes.add(y === 'away' ? 'Away' : y); }
    }
    const status = !open ? 'clash' : hit ? 'part' : 'free';
    return { v, from: w[0], to: w[1], status, note: [...notes].join(', ') + (status === 'clash' && !notes.size ? 'Only weekend days in the window' : '') };
  });
  return { sched, S, d1s, okD, ranges, level, D1, rows, screenClosed };
}

/** The first open day at least two days from today: screening is booked at least 48 hours ahead. */
export function earliestScreen(site) {
  const c = closedDays(site, []);
  let d = addDays(new Date(new Date().setHours(12, 0, 0, 0)), 2);
  for (let i = 0; i < 14 && c.closed(d); i++) d = addDays(d, 1);
  return iso(d);
}

/** Window text the way protocols write it: ±2, +3, -1/+2. */
export function winText(v) {
  if (v.dayFrom !== undefined) return 'Day ' + v.dayFrom + ' to ' + v.dayTo;
  const b = v.win || 0, a = v.winAfter !== undefined ? v.winAfter : b;
  if (!a && !b) return 'exact';
  if (a === b) return '±' + b;
  if (!b) return '+' + a;
  if (!a) return '-' + b;
  return '-' + b + '/+' + a;
}
