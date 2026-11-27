/* RAYDAR 2.11: "Check a list" in the Prohibited list panel. The recruiter types what the participant takes, one per
   line, names first ("metfor,in", "Forxiga", "ozempic 1mg weekly"). Each line becomes:
   - ok:      one medicine (an exact name, a single match, or a single close spelling: "metfor,in" → metformin)
   - choose:  several could fit ("sertaline" → Sertraline or Serapine); the recruiter picks one or "None of these"
   - unknown: nothing matches; kept as typed.
   Anything after the name is kept for the med log: a frequency ("weekly", "twice daily") and the rest as dosage. */
import { resolve, lookupList, norm, cap } from './dict.js';

const FREQ = /\b((?:once|twice|three times|four times|1x|2x|3x)\s+(?:a\s+|per\s+)?(?:day|daily|week|weekly|month|monthly)|every\s+(?:morning|night|day|evening|second day|other day|week|fortnight|month)|(?:daily|weekly|fortnightly|monthly|nightly|at night|in the morning|as needed|when needed|prn|bd|bid|tds|tid|qid|mane|nocte))\b/i;

/** "ozempic 1mg weekly" → { name: 'ozempic', dose: '1mg', fr: 'weekly' } */
export function splitLine(line) {
  const t = String(line || '').replace(/^[\s*•\-–·\d.)]+(?=[A-Za-z])/, '').trim(); // "1. Forxiga", "- metformin", "• Jardiance"
  if (!t) return null;
  const words = t.split(/\s+/);
  let i = words.findIndex((w, j) => j > 0 && (/\d/.test(w) || FREQ.test(words.slice(j).join(' ')) && FREQ.exec(words.slice(j).join(' ')).index === 0));
  if (i < 0) i = words.length;
  const name = words.slice(0, i).join(' ').replace(/[,;:.]+$/g, '');
  const rest = words.slice(i).join(' ');
  const f = FREQ.exec(rest);
  const fr = f ? f[0] : '';
  const dose = (f ? rest.replace(f[0], ' ') : rest).replace(/\s+/g, ' ').replace(/^[,;\s]+|[,;\s]+$/g, '');
  return { typed: t, name, dose, fr };
}

const setKey = (x) => (x.ii || []).slice().sort((a, b) => a - b).join(',');
/** One entry per distinct medicine (same active ingredients), shortest name first */
function distinct(L) {
  const seen = new Map();
  L.forEach((x) => { const k = setKey(x); if (!seen.has(k)) seen.set(k, x); });
  return [...seen.values()];
}

/** What one typed name is */
export function matchName(name) {
  const clean = String(name || '').replace(/[,;:.]+/g, '').trim();
  if (clean.length < 2) return { kind: 'unknown', opts: [] };
  const exact = resolve(clean);
  const L = lookupList(clean, 40);
  if (exact && exact.name === norm(clean)) {
    const e = [...L.pre, ...L.close].find((x) => x.name === exact.name);
    if (e) return { kind: 'ok', pick: e, fixed: false, opts: [] };
  }
  const pre = distinct(L.pre);
  if (pre.length === 1) return { kind: 'ok', pick: pre[0], fixed: false, opts: [] };
  if (pre.length > 1) return { kind: 'choose', ask: 'Which one?', opts: pre.slice(0, 6) };
  const close = distinct(L.close);
  if (close.length === 1) return { kind: 'ok', pick: close[0], fixed: true, opts: [] };
  if (close.length > 1) return { kind: 'choose', ask: 'Did you mean?', opts: close.slice(0, 5) };
  return { kind: 'unknown', opts: [] };
}

/** Every line of the box */
export function readList(text) {
  return String(text || '').split(/\r?\n/).map(splitLine).filter(Boolean).map((l) => ({ ...l, ...matchName(l.name) }));
}

/** The name to show and log: as typed when the match only adds a strength or maker ("Jardiamet 5 mg/500 mg",
    "Vitamin d (oviit)"), else the dictionary's name ("metfor,in" → Metformin) */
export function showName(l, e) {
  const typed = String(l.name || '').replace(/[,;:.]+/g, '').trim();
  return e && !String(e.label).toLowerCase().startsWith(typed.toLowerCase()) ? cap(e.label) : cap(typed);
}
/** The chosen medicine for a line: its match, the recruiter's pick, or none (kept as typed) */
export function chosen(l, choice) {
  return l.kind === 'ok' ? l.pick : l.kind === 'choose' && choice != null && choice !== 'none' ? l.opts[choice] : null;
}
/** The med log entry for a line, once it's settled */
export function logEntry(l, choice) {
  const e = chosen(l, choice), short = showName(l, e);
  // the med log and the prohibited-list check must recognise it again, so keep the full name when the short one isn't known
  return { n: e && !resolve(short) ? cap(e.label) : short, dose: l.dose, fr: l.fr, known: !!e };
}
