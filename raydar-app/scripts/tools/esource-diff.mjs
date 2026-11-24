// What changed between two versions of an eSource file, in recruiter terms, and what it affects in RAYDAR.
// Run from raydar-app/:  npm run study:diff -- <old.json> <new.json>
//   <old.json> can also be "git:<ref>" to compare with the committed copy, e.g. git:HEAD or git:main
//   npm run study:diff -- git:HEAD "Emeritus Sydney - V175-001 - pre-screening.json"
// Prints Markdown: questions added, removed and reworded, answers and outcomes changed, conditions changed,
// study notes lines added and removed (date sentences flagged), and which saved callbacks will re-ask questions.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { convert } from '../../src/esource/convert.js';
import { rulesFor } from '../../src/esource/qcrules.js';
import { qhash } from '../../src/esource/codes.js';
import { readJson, resolveEsource, REPO, text, DATE_RE, outcomeWord } from './lib/common.mjs';

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error('Usage: npm run study:diff -- <old.json | git:REF> <new.json>');
  process.exit(2);
}
const newPath = resolveEsource(b);
function load(arg) {
  if (arg.startsWith('git:')) {
    const rel = path.relative(REPO, newPath).split(path.sep).join('/');
    return JSON.parse(execFileSync('git', ['show', arg.slice(4) + ':' + rel], { cwd: REPO, encoding: 'utf8', maxBuffer: 64e6 }));
  }
  return readJson(resolveEsource(arg));
}
const base = path.basename(newPath);
const A = convert(base, load(a), null), B = convert(base, readJson(newPath), null);
const byId = (s) => Object.fromEntries(s.Q.map((q) => [q.id, q]));
const QA = byId(A), QB = byId(B);
const out = ['# ' + B.code + ' · ' + B.site + ': what changed', '', 'Old: `' + a + '` · New: `' + b + '`', ''];
const short = (t, n = 110) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const ans = (q) => (q.a || []).map((x) => x[0] + ' [' + (outcomeWord[x[1]] || x[1]) + ']');
/** Only the part of a sentence that changed: "…before [removed → added] after…" */
function wordDiff(x, y) {
  let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++;
  let j = 0; while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
  const pre = x.slice(Math.max(0, i - 40), i), post = x.slice(x.length - j, x.length - j + 40);
  const was = x.slice(i, x.length - j), now = y.slice(i, y.length - j);
  return '…' + pre + '[' + (was ? 'removed "' + was + '"' : '') + (was && now ? ' → ' : '') + (now ? 'added "' + now + '"' : '') + ']' + post + '…';
}
const notesOf = (q) => (q.before || []).concat(q.after || []).map((x) => text(x.html)).join('\n');

const added = B.Q.filter((q) => !QA[q.id] && q.kind !== 'note');
const removed = A.Q.filter((q) => !QB[q.id] && q.kind !== 'note');
const changed = [];
B.Q.forEach((q) => {
  const o = QA[q.id];
  if (!o || q.kind === 'note') return;
  const c = [];
  if (o.t !== q.t) c.push('Wording: ' + wordDiff(o.t, q.t));
  if ((o.r || '') !== (q.r || '')) c.push('Recruiter hint changed');
  const oa = ans(o), na = ans(q);
  if (JSON.stringify(oa) !== JSON.stringify(na)) {
    const gone = oa.filter((x) => !na.includes(x)), come = na.filter((x) => !oa.includes(x));
    c.push('Answers: ' + (gone.length ? 'removed ' + gone.map((x) => '"' + x + '"').join(', ') : '') + (gone.length && come.length ? '; ' : '') + (come.length ? 'now ' + come.map((x) => '"' + x + '"').join(', ') : ''));
  }
  if ((o.vis ? o.vis.src : '') !== (q.vis ? q.vis.src : '')) c.push('Shows when: "' + (o.vis ? o.vis.src : 'always') + '" → "' + (q.vis ? q.vis.src : 'always') + '"');
  if (notesOf(o) !== notesOf(q)) c.push('Notes beside it changed');
  if (o.sec !== q.sec) c.push('Moved from "' + o.sec + '" to "' + q.sec + '"');
  if (c.length) changed.push({ q, c, reask: qhash(o) !== qhash(q) });
});

out.push('## Questions');
if (!added.length && !removed.length && !changed.length) out.push('No question changes.');
added.forEach((q) => out.push('- **Added** `' + q.id + '` (' + q.sec + '): "' + short(q.t) + '"' + (q.a && q.a.length ? ' · ' + ans(q).join(' / ') : '')));
removed.forEach((q) => out.push('- **Removed** `' + q.id + '` (' + q.sec + '): "' + short(q.t) + '"'));
changed.forEach(({ q, c }) => { out.push('- **Changed** `' + q.id + '` "' + short(q.t, 80) + '"'); c.forEach((x) => out.push('  - ' + x)); });
out.push('');

// Study notes: line-level comparison
const nl = (s) => s.notes.flatMap((n) => n.blocks.map((x) => text(x.html))).join('\n').split('\n');
const NA = nl(A), NB = nl(B);
const gone = NA.filter((l) => !NB.includes(l)), come = NB.filter((l) => !NA.includes(l));
out.push('## Study notes');
if (!gone.length && !come.length) out.push('No changes.');
gone.forEach((l) => out.push('- Removed' + (DATE_RE.test(l) ? ' **(dates)**' : '') + ': ' + short(l, 240)));
come.forEach((l) => out.push('- Added' + (DATE_RE.test(l) ? ' **(dates)**' : '') + ': ' + short(l, 240)));
out.push('');

// Quick check
const rk = (s) => rulesFor(s).map((r) => r.item + '=' + r.when + '→' + r.result + ' (' + r.why + ')');
const RA = rk(A), RB = rk(B);
out.push('## Quick check rules');
if (JSON.stringify(RA) === JSON.stringify(RB)) out.push('Unchanged.');
RA.filter((r) => !RB.includes(r)).forEach((r) => out.push('- No longer: ' + r));
RB.filter((r) => !RA.includes(r)).forEach((r) => out.push('- New: ' + r));
if (JSON.stringify(A.age) !== JSON.stringify(B.age)) out.push('- Age range: ' + JSON.stringify(A.age) + ' → ' + JSON.stringify(B.age));
if (JSON.stringify(A.bmi) !== JSON.stringify(B.bmi)) out.push('- BMI range: ' + JSON.stringify(A.bmi) + ' → ' + JSON.stringify(B.bmi));
out.push('');

// What to do
out.push('## What it affects in RAYDAR');
const reask = changed.filter((x) => x.reask).length + removed.length;
out.push('- Saved callback PDFs: ' + (reask ? reask + ' question(s) will be asked again (or dropped) when an older callback is reopened.' : 'reopen unchanged.'));
if (gone.concat(come).some((l) => DATE_RE.test(l))) out.push('- **Date sentences changed in the study notes: re-read the cohort dates (raydar-cohort-dates skill) before publishing.**');
if (B.issues.length > A.issues.length) out.push('- The file check found ' + (B.issues.length - A.issues.length) + ' more problem(s) than before: run `npm run study:report` on the new file.');
out.push('- Rebuild and run the tests (raydar-release skill) before the new file reaches recruiters.');
console.log(out.join('\n'));
