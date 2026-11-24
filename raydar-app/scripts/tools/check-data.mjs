// Checks RAYDAR's hand-kept data files before a build: RAYDAR cohort dates.json, RAYDAR visit schedules.json and
// RAYDAR quick check.json. Catches the mistakes that are easy to make by hand: dates that aren't real dates, a stay
// whose nights don't match its check-in and check-out, a day-visit study recorded as an overnight stay, follow-ups
// before Day 1, a missing source sentence, a rule pointing at a file that doesn't exist.
// Run from raydar-app/:  npm run study:check-data      Exit code 1 on errors (warnings don't fail).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readJson, DATES_FILE, SCHEDULES_FILE, QC_FILE, ESOURCE_DIR } from './lib/common.mjs';

const errors = [], warns = [];
const err = (w, m) => errors.push(w + ': ' + m), warn = (w, m) => warns.push(w + ': ' + m);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const day = (s) => new Date(s + 'T00:00:00Z');
const okDate = (s) => typeof s === 'string' && ISO.test(s) && !isNaN(day(s)) && day(s).toISOString().slice(0, 10) === s;
const nights = (a, b) => Math.round((day(b) - day(a)) / 864e5);

/* ---- cohort dates ---- */
const D = readJson(DATES_FILE);
for (const [file, st] of Object.entries(D)) {
  if (file.startsWith('_')) continue;
  const w = 'cohort dates · ' + file;
  if (!existsSync(path.join(ESOURCE_DIR, file))) err(w, 'no eSource file with this name in "Pre-screening eSource JSONs" (renamed?)');
  const types = st.types || {};
  if (!Array.isArray(st.cohorts) || !st.cohorts.length) { err(w, 'no cohorts'); continue; }
  const ids = new Set();
  st.cohorts.forEach((c, i) => {
    const cw = w + ' · ' + (c.n || c.id || 'cohort ' + (i + 1));
    if (!c.id) err(cw, 'missing id'); else if (ids.has(c.id)) err(cw, 'id "' + c.id + '" used twice'); else ids.add(c.id);
    if (!c.n) err(cw, 'missing name (n)');
    if (!types[c.t]) err(cw, 'type "' + c.t + '" is not in types');
    if (!okDate(c.in) || !okDate(c.out)) { err(cw, 'in/out must be real dates as YYYY-MM-DD (got ' + c.in + ', ' + c.out + ')'); return; }
    if (c.out < c.in) err(cw, 'checks out before checking in');
    const t = types[c.t];
    if (t && typeof t.nights === 'number') {
      const n = nights(c.in, c.out);
      if (t.nights === 0 && n !== 0) err(cw, 'its type is a day visit (0 nights) but in and out are ' + n + ' days apart');
      else if (t.nights > 0 && n !== t.nights && !/separate|stays\b/i.test(t.stay || '')) warn(cw, 'type says ' + t.nights + ' nights, dates give ' + n);
    }
    if (!c.src || String(c.src).trim().length < 10) err(cw, 'no source sentence (src): every date must quote the study notes');
    let last = '';
    (c.v || []).forEach((v, j) => {
      const vw = cw + ' · visit ' + (v.l || j + 1);
      if (!okDate(v.d)) { err(vw, 'date must be YYYY-MM-DD (got ' + v.d + ')'); return; }
      if ((v.a && !okDate(v.a)) || (v.b && !okDate(v.b))) err(vw, 'window a/b must be YYYY-MM-DD');
      if (v.a && v.b && v.b < v.a) err(vw, 'window ends before it starts');
      if (!v.a && !(v.w >= 0)) warn(vw, 'no window (w, or a and b): treated as an exact day');
      if (!v.a && v.d < c.in) warn(vw, 'is before check-in / Day 1 (fine only for pre-admission visits)');
      if (last && v.d < last) warn(vw, 'visits are not in date order');
      last = v.d;
    });
    const y = +c.in.slice(0, 4), now = new Date().getFullYear();
    if (y < now - 1 || y > now + 2) warn(cw, 'year ' + y + ' looks unlikely: the study notes don\'t write years, check the inference');
  });
}

/* ---- visit schedules (Emeritus rolling studies) ---- */
const V = readJson(SCHEDULES_FILE);
for (const [code, key] of Object.entries(V.byCode || {})) if (!V.schedules || !V.schedules[key]) err('visit schedules · ' + code, 'points at schedule "' + key + '", which doesn\'t exist');
for (const [key, s] of Object.entries(V.schedules || {})) {
  const w = 'visit schedules · ' + key;
  if (!(s.screenMinToD1 >= 0) || !(s.screenMaxToD1 >= s.screenMinToD1)) err(w, 'screenMinToD1 / screenMaxToD1 missing or the wrong way round');
  if (!Array.isArray(s.visits) || !s.visits.length) { err(w, 'no visits'); continue; }
  s.visits.forEach((v, i) => {
    const vw = w + ' · ' + (v.name || 'visit ' + (i + 1));
    if (!v.name) err(vw, 'no name');
    if (!['clinic', 'phone', 'remote'].includes(v.type)) err(vw, 'type must be clinic, phone or remote');
    if (v.day === undefined && (v.dayFrom === undefined || v.dayTo === undefined)) err(vw, 'needs day, or dayFrom and dayTo');
  });
  if (!s.visits.some((v) => v.day === 1)) warn(w, 'no Day 1 visit: is the anchor right?');
}
for (const city of ['melbourne', 'sydney']) {
  const H = (V.holidays || {})[city] || {};
  const last = Object.keys(H).sort().pop();
  if (!last) warn('holidays · ' + city, 'none listed');
  else if (last < new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)) warn('holidays · ' + city, 'public holidays end ' + last + ': add the next year so long studies are checked');
}

/* ---- quick check settings ---- */
const Q = readJson(QC_FILE);
const keys = new Set();
(Q.conditions || []).forEach((c) => {
  const w = 'quick check · condition ' + (c.key || '?');
  if (!c.key || !c.label || !c.match) err(w, 'needs key, label and match');
  if (keys.has(c.key)) err(w, 'key used twice'); keys.add(c.key);
  ['match', 'answer', 'answerNot'].forEach((k) => { if (c[k]) try { new RegExp(c[k], 'i'); } catch (e) { err(w, k + ' is not a valid pattern: ' + e.message); } });
});
(Q.rules || []).forEach((r, i) => {
  const w = 'quick check · rule ' + (i + 1) + ' (' + (r.file || '?') + ')';
  if (!r.file || !existsSync(path.join(ESOURCE_DIR, r.file))) err(w, 'file not found in the eSource folder');
  if (!(r.item === 'smoke' || r.item === 'meds' || keys.has(r.item))) err(w, 'item "' + r.item + '" is not smoke, meds or a condition key');
  if (!['y', 'n'].includes(r.when)) err(w, 'when must be y or n');
  if (!['no', 'check'].includes(r.result)) err(w, 'result must be no or check');
  if (!r.source) err(w, 'no source: quote the eSource wording the rule comes from');
});
(Q.ignore || []).forEach((g, i) => { if (!g.file || !g.question) err('quick check · ignore ' + (i + 1), 'needs file and question'); });

console.log('# RAYDAR data check\n');
console.log(errors.length ? '## Errors (' + errors.length + ')\n' + errors.map((e) => '- ' + e).join('\n') + '\n' : 'No errors.\n');
if (warns.length) console.log('## Worth a look (' + warns.length + ')\n' + warns.map((e) => '- ' + e).join('\n'));
process.exit(errors.length ? 1 : 0);
