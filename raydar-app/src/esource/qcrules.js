/* Quick check rules (RAYDAR 2.7), read from each study's own eSource questions.
   A study gets a rule for a Quick check item when one of its questions asks about that item directly and its answers
   carry outcome markers. "Have you been diagnosed with a form of diabetes?" answered "No - Exclude" means the study
   needs type 2 diabetes; "Have you used any tobacco or vaping products?" answered "Yes - exclude" rules out smokers.
   Only the plain status questions count: follow-ups, "is that okay?" agreements, tests, treatments and "other forms
   of" questions are left for the pre-screen. A rule only rules a study out when every matching answer excludes; when
   some answers carry on it waits for the pre-screen, and doctor checks become "check".
   Conditions, extra rules and corrections come from "RAYDAR quick check.json". */
import CONFIG_JSON from '../../../RAYDAR quick check.json';

export let QC = parse(CONFIG_JSON);
/** [key, label, sex] for every condition Quick check knows; kept in step with the settings file */
export const CONDS = [];
const fill = () => CONDS.splice(0, CONDS.length, ...QC.conditions.map((c) => [c.key, c.label, c.sex]));
fill();

function rx(s) { try { return s ? new RegExp(s, 'i') : null; } catch (e) { return null; } }
function parse(j) {
  const conditions = (j.conditions || []).filter((c) => c && c.key && c.label && c.match)
    .map((c) => ({ key: String(c.key), label: String(c.label), match: rx(c.match), answer: rx(c.answer), answerNot: rx(c.answerNot), sex: c.sex === 'm' || c.sex === 'f' ? c.sex : null, src: c.match }))
    .filter((c) => c.match);
  return { conditions, rules: Array.isArray(j.rules) ? j.rules : [], ignore: Array.isArray(j.ignore) ? j.ignore : [] };
}
/** Use a new settings file (Tools → Study files). Returns an error message, or ''. */
export function setConfig(j) {
  if (!j || !Array.isArray(j.conditions)) return 'No "conditions" list in it';
  QC = parse(j);
  fill();
  return '';
}

const SMOKE = { key: 'smoke', label: 'Smokes, vapes or nicotine', match: /smok|vap(e|es|ing)\b|nicotine|tobacco|cigar/i };
const SKIP_ALL = /\bok(ay)?\b|happy to|willing|refrain|\btests?\b|other (forms?|causes?|types?)|other than|intoleran|hypersensitiv|allerg|treat|medication|therap|surgery|transplant|exacerbation|infect|bleach|\beye\b/i;
const SKIP_SMOKE = /\bok(ay)?\b|refrain|\btests?\b|pack.?years?|last time|when did|how (many|much|long)|history of/i;
const NO = /^(no\b|not\b|none\b|never\b|has never|have never|n\/a\b)|not diagnosed/i;
const FORMER = /former|ex-?smoker|used to|quit|stopped/i;
const clean = (t) => String(t || '').replace(/[☀-➿️\u{1F300}-\u{1FAFF}]/gu, '').replace(/\s+/g, ' ').trim();

/** The condition this question asks the participant whether they have, if any. */
function condFor(q) {
  const t = q.t || '';
  if (SKIP_ALL.test(t)) return null;
  for (const c of QC.conditions) {
    const m = new RegExp('(?:\\bhave|\\bhaving|diagnosed with|suffer(?:ing)? from)\\s+(?:(?:a|an|any|the|chronic|current|currently|known|diagnosed)\\s+|(?:form|history|diagnosis) of\\s+)*(?:' + c.match.source + ')[\\w-]*', 'i').exec(t);
    if (!m) continue;
    // "atopic dermatitis that is currently infected" is about something else
    if (/^\s*(\([^)]*\)\s*)?(that (is|are|was|were)|which|requiring|related|caused|due|for which)\b/i.test(t.slice(m.index + m[0].length))) continue;
    return { c, duration: /how long/i.test(t) };
  }
  return null;
}
function smokeQ(q) {
  const t = q.t || '';
  if (!SMOKE.match.test(t) || SKIP_SMOKE.test(t)) return false;
  return /\b(do|are|have|did)\s+you\b/i.test(t);
}
/** What a set of answer outcomes means for Quick check: rule out, check, or nothing (left to the pre-screen). */
function verdict(outs) {
  if (!outs.length) return null;
  if (outs.every((o) => o === 'x')) return 'no';
  if (outs.some((o) => o === 'c' || o === 'n' || o === 'i')) return null;
  return 'check';
}

/** The Quick check rules for one converted study: [{ item, when, result, why, q, qt, a, auto }] */
export function rulesFor(s) {
  const out = [], file = s.file;
  const ignored = (qid, item) => QC.ignore.some((g) => g && g.file === file && g.question === qid && (!g.item || g.item === item));
  const sexIds = new Set(s.Q.filter((q) => q.auto === 'sex').map((q) => q.id));
  s.Q.forEach((q) => {
    if (q.kind !== 'choice' || q.auto || !q.a || q.a.length < 2) return;
    if (q.vis && !(q.vis.deps || []).every((d) => sexIds.has(d))) return; // a follow-up: leave it to the pre-screen
    let item, label, duration = false, ans = null, ansNot = null;
    const cf = condFor(q);
    if (cf) { item = cf.c.key; label = cf.c.label; duration = cf.duration; ans = cf.c.answer; ansNot = cf.c.answerNot; }
    else if (smokeQ(q)) { item = 'smoke'; label = SMOKE.label; }
    else return;
    if (ignored(q.id, item)) return;
    const A = q.a.map((b) => ({ l: clean(b[0]), o: b[1] }));
    const no = A.filter((b) => NO.test(b.l));
    const former = item === 'smoke' ? A.filter((b) => !NO.test(b.l) && FORMER.test(b.l)) : [];
    let yes = A.filter((b) => !no.includes(b) && !former.includes(b));
    if (ans) {
      const own = yes.filter((b) => ans.test(b.l) && !(ansNot && ansNot.test(b.l)));
      yes = own.length ? own : yes.filter((b) => !(ansNot && ansNot.test(b.l)));
    }
    const add = (when, res, picked) => {
      if (!res) return;
      out.push({ item, when, result: res, q: q.id, qt: q.t, a: picked.map((b) => b.l).join(' / '), auto: true, why: whyText(item, label, when, res, res === 'check' ? picked.map((b) => b.l).join(' / ') : '') });
    };
    add('y', verdict(yes.map((b) => b.o)), yes);
    if (duration && !no.length) add('n', 'no', [{ l: 'asks how long since diagnosis, so it needs the diagnosis' }]);
    else add('n', verdict(no.concat(former).map((b) => b.o)), no.concat(former));
  });
  QC.rules.forEach((r) => {
    if (!r || r.file !== file || !r.item || !['y', 'n'].includes(r.when) || !['no', 'check'].includes(r.result)) return;
    out.push({ item: r.item, when: r.when, result: r.result, why: String(r.why || ''), q: '', qt: String(r.source || ''), a: '', auto: false });
  });
  // one rule per item and answer: the strongest
  const best = {};
  out.forEach((r) => { const k = r.item + ':' + r.when; if (!best[k] || (r.result === 'no' && best[k].result !== 'no')) best[k] = r; });
  return Object.values(best);
}

function whyText(item, label, when, res, ans) {
  const l = item === 'smoke' ? 'smoking or vaping' : label.replace(/ \(.*\)$/, '');
  const low = /^[A-Z]{2,}/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1);
  const said = ans ? ': "' + ans.slice(0, 60) + '"' : '';
  if (item === 'smoke') return when === 'y' ? (res === 'no' ? 'Excludes smokers and vapers' : 'Check smoking or vaping' + said) : (res === 'no' ? 'Needs a smoking history' : 'Check smoking history' + said);
  if (when === 'n') return res === 'no' ? 'Recruits ' + low + ' only' : 'Check: recruits ' + low + said;
  return res === 'no' ? 'Excludes ' + low : 'Check ' + low + said;
}

/**
 * Conditions a study needs that Quick check doesn't ask about yet: a "Do you have X?" question that excludes "No".
 * Shown in Tools → Study files, so someone can add X to "RAYDAR quick check.json".
 */
export function missingConditions(s) {
  const out = [];
  s.Q.forEach((q) => {
    if (q.kind !== 'choice' || q.auto || q.vis || !q.a) return;
    const t = q.t || '';
    if (SKIP_ALL.test(t) || condFor(q) || smokeQ(q)) return;
    const m = /(?:\bdo you (?:currently )?have|diagnosed with|diagnosis of)\s+(?:(?:a|an|any|chronic|current)\s+)*([a-z][\w\s-]{2,40}?)(?=\s*(?:\?|,|\(|\bthat\b|\bwhich\b|\bconfirmed\b|$))/i.exec(t);
    if (!m || /\b(your|from|after|pain)\b/i.test(m[1])) return;
    const A = q.a.map((b) => ({ l: clean(b[0]), o: b[1] }));
    const no = A.filter((b) => NO.test(b.l)), yes = A.filter((b) => !NO.test(b.l));
    if (no.length && no.every((b) => b.o === 'x') && yes.some((b) => b.o === 'c')) out.push({ name: m[1].trim(), q: q.id, qt: t });
  });
  return out;
}
