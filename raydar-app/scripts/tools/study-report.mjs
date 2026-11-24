// RAYDAR study report: what RAYDAR will make of an eSource file, before anyone builds or publishes it.
// Run from raydar-app/:  npm run study:report -- "<eSource file or part of its name>" [more files] [--all]
// Prints Markdown. Exit code 1 when something must be fixed before the study goes live.
import path from 'node:path';
import { convert } from '../../src/esource/convert.js';
import { rulesFor, missingConditions } from '../../src/esource/qcrules.js';
import { scheduleKeyFor } from '../../src/esource/schedule.js';
import { protoCode } from '../../src/esource/codes.js';
import { readJson, resolveEsource, esourceFiles, ESOURCE_DIR, DATES_FILE, NAME_RE, text, DATE_RE, outcomeWord } from './lib/common.mjs';

const args = process.argv.slice(2);
const files = args.includes('--all') ? esourceFiles().map((f) => path.join(ESOURCE_DIR, f)) : args.filter((a) => !a.startsWith('--')).map(resolveEsource);
if (!files.length) {
  console.error('Usage: npm run study:report -- "<eSource file or part of its name>" [--all]');
  process.exit(2);
}
const DATES = readJson(DATES_FILE);
let blocking = 0;

for (const file of files) {
  const base = path.basename(file);
  const out = [];
  const must = [], look = [];
  let json;
  try { json = readJson(file); } catch (e) { console.log('## ' + base + '\n\n**Not valid JSON:** ' + e.message + '\n'); blocking++; continue; }
  if (!json || !Array.isArray(json.pages)) { console.log('## ' + base + '\n\n**Not an eSource form** (no "pages").\n'); blocking++; continue; }
  const s = convert(base, json, DATES[base]);
  const qs = s.Q.filter((q) => q.kind !== 'note');
  const kinds = {};
  qs.forEach((q) => (kinds[q.kind] = (kinds[q.kind] || 0) + 1));

  out.push('## ' + s.code + ' · ' + s.site);
  out.push('');
  out.push('| | |');
  out.push('|---|---|');
  out.push('| File | `' + base + '`' + (NAME_RE.test(base) ? '' : ' **(name doesn\'t follow "Site - CODE - pre-screening.json")**') + ' |');
  out.push('| eSource title | ' + (json.title || '(none)') + (s.version ? ' · version ' + s.version : '') + ' |');
  out.push('| Protocol code in file names and PDFs | `' + protoCode(s) + '` |');
  out.push('| Questions | ' + qs.length + ' (' + Object.entries(kinds).map(([k, n]) => n + ' ' + k).join(', ') + '), ' + (s.Q.length - qs.length) + ' note steps, ' + s.hidden + ' hidden in the eSource |');
  out.push('| Sections | ' + [...new Set(s.Q.map((q) => q.sec))].join(' · ') + ' |');
  out.push('| Age range (Quick check) | ' + (s.age ? s.age[0] + (s.age[1] >= 120 ? '+' : ' to ' + s.age[1]) : 'none found') + ' |');
  out.push('| BMI range (Quick check) | ' + (s.bmi ? (s.bmi[1] >= 100 ? s.bmi[0] + '+' : s.bmi[0] + ' to ' + s.bmi[1]) : 'none found') + ' |');
  if (!NAME_RE.test(base)) must.push('Rename the file to "Site - CODE - pre-screening.json" (Site is Emeritus Melbourne, Emeritus Sydney or Veritus), or RAYDAR can\'t tell the site.');
  if (!s.age) look.push('No age range was found. Check the date of birth question and its conditions.');

  // dates
  const sched = /emeritus/i.test(s.site) && !s.cohorts ? scheduleKeyFor(s.code) : null;
  out.push('| Dates | ' + (s.cohorts ? s.cohorts.length + ' cohort(s) in RAYDAR cohort dates.json' : sched ? 'rolling: visit schedule `' + sched + '` in RAYDAR visit schedules.json' : '**none**') + ' |');
  const notesText = s.notes.flatMap((n) => n.blocks.map((b) => text(b.html))).join('\n');
  const dateLines = notesText.split('\n').filter((l) => DATE_RE.test(l));
  if (!s.cohorts && !sched) {
    if (/emeritus/i.test(s.site)) must.push('No visit schedule for this Emeritus study. Use the raydar-visit-schedule skill (protocol schedule of activities), or confirm it has no fixed dates.');
    else if (dateLines.length) must.push('The study notes mention dates but RAYDAR cohort dates.json has no entry. Use the raydar-cohort-dates skill.');
  }
  out.push('');

  // Quick check
  out.push('### Quick check rules read from the questions');
  const rules = rulesFor(s);
  if (!rules.length) out.push('- None (only age, BMI, sex and pregnancy apply).');
  rules.forEach((r) => out.push('- **' + r.why + '** (' + r.item + ' = ' + r.when + ' → ' + r.result + ')' + (r.auto ? ' ← "' + r.qt.slice(0, 110) + '" · answer "' + r.a.slice(0, 60) + '"' : ' ← RAYDAR quick check.json: "' + r.qt.slice(0, 110) + '"')));
  missingConditions(s).forEach((m) => look.push('Needs "' + m.name + '", which Quick check doesn\'t ask about ("' + m.qt.slice(0, 100) + '"). Add a condition to RAYDAR quick check.json (raydar-quick-check skill).'));
  if (s.male) out.push('- Men only (the sex question excludes Female).');
  if (s.female) out.push('- Women only (the sex question excludes Male).');
  out.push('');

  // markers and file check
  const unmarked = qs.filter((q) => q.kind === 'choice' && !q.auto && q.a.some((b) => b[1] === 'i'));
  if (unmarked.length) {
    out.push('### Answers without an outcome marker (✅ ⚠️ 🛑 🚫)');
    unmarked.slice(0, 15).forEach((q) => out.push('- `' + q.id + '` "' + q.t.slice(0, 90) + '": ' + q.a.filter((b) => b[1] === 'i').map((b) => '"' + b[0].slice(0, 50) + '"').join(', ')));
    if (unmarked.length > 15) out.push('- … and ' + (unmarked.length - 15) + ' more');
    out.push('');
    look.push(unmarked.length + ' question(s) have answers without an outcome marker, so RAYDAR shows them grey and can\'t suggest them.');
  }
  const issues = s.issues.filter((i) => !/no outcome marker/.test(i.msg)); // listed in full above
  if (issues.length) {
    out.push('### File check');
    issues.forEach((i) => out.push('- ' + (i.q ? '`' + i.q + '`: ' : '') + i.msg));
    out.push('');
    issues.forEach((i) => (/never shows|can't be read|no such answer/.test(i.msg) ? must : look).push((i.q ? '`' + i.q + '`: ' : '') + i.msg));
  }

  // prohibited lists
  out.push('### Prohibited lists read from the notes');
  const P = s.pro || {};
  ['med', 'hx'].forEach((k) => {
    const L = P[k] || [];
    out.push('- ' + (k === 'med' ? 'Medications' : 'Conditions') + ': ' + L.length + (L.length ? ', first ones: ' + L.slice(0, 6).map((p) => '"' + p.n.slice(0, 40) + '" (' + (p.o === 'x' ? 'exclude' : 'doctor') + ')').join(', ') : ''));
  });
  const proSrc = [...new Set([...(s.proNotes?.med || []), ...(s.proNotes?.hx || [])].map((n) => n.title || n.name))];
  if (proSrc.length) out.push('- Read from: ' + proSrc.slice(0, 8).map((t) => '"' + String(t).slice(0, 60) + '"').join(', '));
  out.push('- Check none of these came from a note that isn\'t a prohibited list (holiday or travel info was misread once).');
  out.push('');

  if (dateLines.length) {
    out.push('### Date sentences in the study notes');
    dateLines.slice(0, 20).forEach((l) => out.push('> ' + l.slice(0, 260)));
    out.push('');
  }

  out.push('### Verdict');
  if (!must.length && !look.length) out.push('Ready: nothing to fix.');
  must.forEach((m) => out.push('- **Fix before publishing:** ' + m));
  look.forEach((m) => out.push('- Worth a look: ' + m));
  out.push('');
  blocking += must.length;
  console.log(out.join('\n'));
}
process.exit(blocking ? 1 : 0);
