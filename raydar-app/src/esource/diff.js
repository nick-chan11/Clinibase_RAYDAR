/* What changed between two versions of a study, in recruiter terms (RAYDAR 2.8). Used by the study admin before
   publishing; scripts/tools/esource-diff.mjs prints the same kind of report from the command line. */
import { convert, plain } from './convert.js';
import { qhash } from './codes.js';

const text = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
export const DATE_RE = /\b(\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?|Day\s*-?\d+|in-clinic stay|overnight|nights?\b|FILLED|week\s*\d+)/i;
const word = { c: 'continue', d: 'doctor', x: 'exclude', n: 'follow-up', i: 'no marker' };

/** Only the part of a sentence that changed */
export function wordDiff(x, y) {
  let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++;
  let j = 0; while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
  return { before: x.slice(Math.max(0, i - 40), i), was: x.slice(i, x.length - j), now: y.slice(i, y.length - j), after: x.slice(x.length - j, x.length - j + 40) };
}

/** { questions: [{ kind, id, title, details }], notes: { added, removed }, reask, datesNotes } */
export function diffStudies(file, oldJson, newJson) {
  const A = oldJson ? convert(file, oldJson) : { Q: [], notes: [] }, B = convert(file, newJson);
  const QA = Object.fromEntries(A.Q.map((q) => [q.id, q])), QB = Object.fromEntries(B.Q.map((q) => [q.id, q]));
  const ans = (q) => (q.a || []).map((x) => plain(x[0]) + ' [' + (word[x[1]] || x[1]) + ']');
  const notesOf = (q) => (q.before || []).concat(q.after || []).map((x) => text(x.html).join(' ')).join('\n');
  const out = [];
  B.Q.forEach((q) => {
    if (q.kind === 'note') return;
    const o = QA[q.id];
    if (!o) { out.push({ kind: 'added', id: q.id, title: q.t, sec: q.sec, details: [] }); return; }
    const d = [];
    if (o.t !== q.t) d.push({ kind: 'wording', ...wordDiff(o.t, q.t) });
    if ((o.r || '') !== (q.r || '')) d.push({ kind: 'hint' });
    const oa = ans(o), na = ans(q);
    if (JSON.stringify(oa) !== JSON.stringify(na)) d.push({ kind: 'answers', gone: oa.filter((x) => !na.includes(x)), come: na.filter((x) => !oa.includes(x)) });
    if ((o.vis ? o.vis.src : '') !== (q.vis ? q.vis.src : '')) d.push({ kind: 'when', was: o.vis ? o.vis.src : 'always', now: q.vis ? q.vis.src : 'always' });
    if (notesOf(o) !== notesOf(q)) d.push({ kind: 'notes' });
    if (o.sec !== q.sec) d.push({ kind: 'moved', was: o.sec, now: q.sec });
    if (d.length) out.push({ kind: 'changed', id: q.id, title: q.t, sec: q.sec, details: d, reask: qhash(o) !== qhash(q) });
  });
  A.Q.forEach((q) => { if (q.kind !== 'note' && !QB[q.id]) out.push({ kind: 'removed', id: q.id, title: q.t, sec: q.sec, details: [] }); });
  const nl = (s) => s.notes.flatMap((n) => n.blocks.flatMap((x) => text(x.html)));
  const NA = nl(A), NB = nl(B);
  const added = NB.filter((l) => !NA.includes(l)), removed = NA.filter((l) => !NB.includes(l));
  return {
    questions: out,
    notes: { added, removed },
    datesNotes: added.concat(removed).some((l) => DATE_RE.test(l)),
    reask: out.filter((x) => x.kind === 'removed' || x.reask).length,
    ageWas: A.age, ageNow: B.age, bmiWas: A.bmi, bmiNow: B.bmi,
  };
}
