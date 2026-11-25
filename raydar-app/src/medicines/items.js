/* Structured prohibited-list items: what each eSource bullet covers, and checking a logged medicine against them.
   RAYDAR pre-fills each item from the bullet's own words (medicines it names, drug-group words, "in the past 30 days",
   "oral/injectable"); TST confirms or corrects it in the study admin (saved in RAYDAR study settings.json as
   studies[file].proItems[key]). Until confirmed, the pre-fill is used and labelled as RAYDAR's reading.
   Conditions are only ever a "possible match": RAYDAR never decides a diagnosis. */
import { resolve, close, ingIndex, ingName, inGroup, groupName, membersOf, routeWords, routeOfText, norm, dictionary } from './dict.js';
import EXTRAS from '../../../RAYDAR medicine extras.json';

/** The key an item's settings are saved under: the eSource note it came from, and the bullet's text */
export const itemKey = (p) => (p.src || '') + ' | ' + p.n;

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, a: 1 };
const UNIT = { day: 'd', week: 'w', month: 'm', year: 'y' };
export const UNIT_WORDS = { d: 'days', w: 'weeks', m: 'months', y: 'years' };
const DAYS = { d: 1, w: 7, m: 30.44, y: 365.25 };

/** "in the past 30 days", "within 6 months", "last 90 days", "past month", "currently", "ever" */
export function readWindow(text) {
  const t = norm(text);
  const m = /\b(?:past|last|within|previous|prior|preceding|in the)\s+(?:the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|a)?\s*(day|week|month|year)s?\b/.exec(t);
  if (m) return { k: 'in', n: m[1] ? (NUM[m[1]] || parseInt(m[1], 10)) : 1, u: UNIT[m[2]] };
  if (/\b(ever|previous(ly)? (use|receipt)|history of|prior use)\b/.test(t)) return { k: 'ever' };
  if (/\b(current|currently|ongoing|maintenance|regular)\b/.test(t)) return { k: 'cur' };
  return { k: 'none' };
}
/** "oral/injectable", "oral, IM or IV", "systemic" → the routes the item applies to ('' = any) */
export function readRoutes(text) {
  const t = norm(text);
  if (/systemic|oral\s*(\/|or|and)?\s*(injectable|im\b|iv\b)|oral im or iv/.test(t)) return 'ios';
  if (/\btopical\b/.test(t) && !/\boral\b/.test(t)) return 't';
  if (/\boral\b/.test(t) && !/topical/.test(t)) return 'o';
  if (/nasal spray/.test(t)) return 'n';
  return '';
}
/* Ingredients that are only part of another name ("cyproterone acetate") or too general to pick up from a sentence */
const NOT_ALONE = new Set('acetate chloride sodium potassium calcium magnesium phosphate citrate water glucose alcohol ethanol iron zinc copper protein tyrosine glycine lysine arginine histidine leucine isoleucine alanine valine proline serine threonine tryptophan methionine phenylalanine glutamine taurine'.split(' '));
/** Medicines a bullet names, and drug-group words in it. guess: names read through a close spelling, for TST to check */
export function readCovers(text) {
  const raw = String(text || '');
  const t0 = ' ' + norm(raw) + ' ';
  let t = t0;
  const g = [];
  // "vaccines against C. acnes", "RSV vaccine", "flu vaccine": a particular vaccine, not every vaccine
  const particular = /\b(against|for)\s+[a-z]|\b(rsv|hpv|flu|influenza|shingles|zoster|covid|c\.? ?acnes|investigational|study)\b[^.;]{0,25}\bvaccin|\bvaccin\w*\s+(against|for)\b/.test(t);
  for (const gw of EXTRAS.groupWords || []) {
    if (particular && gw.groups.includes('x-vaccine')) continue;
    const re = new RegExp('(^|[^a-z0-9])(' + gw.words + ')(?=$|[^a-z0-9])', 'g');
    if (re.test(t)) { gw.groups.forEach((c) => { if (!g.includes(c)) g.push(c); }); t = t.replace(re, '$1 '); }
  }
  const ings = new Set(), guess = [];
  // "anything ending in gliptin"
  const end = /ending in\s*["“'‘]?([a-z]{4,})/.exec(t0);
  if (end) dictionary().ing.forEach((x) => { if (new RegExp(end[1] + '$').test(x[0]) && !/ \+ /.test(x[0])) ings.add(x[0]); });
  // medicines: ingredients anywhere, brand names only when written with a capital (to skip ordinary words)
  const capWords = new Set((raw.match(/\b[A-Z][A-Za-z0-9-]{3,}\b/g) || []).map((w) => w.toLowerCase()));
  // medicine names are read before the group words come out, so "RSV vaccine" stays one name
  for (const part of t0.split(/[,;/()]| and | or | including | such as | e\.?g\.? | i\.?e\.? /)) {
    const r = resolve(part);
    if (r && !(r.type === 'b' && part.trim() !== r.name && !r.names.every((n) => n.split(' ').some((w) => capWords.has(w))))) {
      r.ings.forEach((i) => { const n = ingName(i); if (!NOT_ALONE.has(n)) ings.add(n); });
      continue;
    }
    // a drug name TST spelt differently ("Flucanazole"): the closest ingredient, marked as a guess
    const words = part.trim().split(' ');
    for (const w of words.filter((x) => x.length >= 7 && (capWords.has(x) || words.length <= 2))) {
      const c = close(w, 1)[0];
      if (c && c.type !== 'b' && c.ings.length === 1) { ings.add(c.ings[0]); guess.push(w + ' → ' + c.ings[0]); }
    }
  }
  return { i: [...ings], g, guess };
}

/* Worked out once per item (and once per set of covers): checking a medicine runs on every screen update */
const PRE = new WeakMap(), COV = new Map();
/** RAYDAR's reading of one bullet, before TST confirms it */
export function prefill(p) {
  if (p && typeof p === 'object' && PRE.has(p)) return JSON.parse(PRE.get(p));
  const out = prefillNow(p);
  if (p && typeof p === 'object') PRE.set(p, JSON.stringify(out));
  return out;
}
function prefillNow(p) {
  const c = readCovers(p.n);
  const cov = { i: c.i, g: c.g };
  // "Diltiazem, Verapamil (calcium channel blockers)" names three drugs, not the whole group: the group is only a
  // suggestion. With "e.g." or "such as", the drugs are examples and the group counts.
  const examples = /\b(e\.?g\.?|eg|such as|including|for example|i\.?e\.?)\b|\bany\b/i.test(p.n);
  let sug = [];
  if (cov.i.length && cov.g.length && !examples) { sug = cov.g; cov.g = []; }
  // a bullet like "MMR" under "Receipt of any live attenuated vaccines" takes the vaccine group from its heading
  const heading = readCovers(p.w).g.filter((x) => x.startsWith('x-vaccine'));
  if (!cov.i.length && !cov.g.length && !/therap|device|laser|light|surgery|transplant|intervention|radio/i.test(p.n)) { if (heading.length) cov.g = heading; }
  // "MMR vaccine" under "Examples of live vaccines": the live group, not every vaccine
  else if (heading.includes('x-vaccine-live') && cov.g.includes('x-vaccine')) cov.g = cov.g.map((g) => (g === 'x-vaccine' ? 'x-vaccine-live' : g));
  let win = readWindow(p.n);
  if (win.k === 'none') win = readWindow(p.w);
  if (win.k === 'none' && p.q) win = readWindow(p.q); // the question the list explains ("In the last 3 months…")
  // a dose threshold ("greater than 10,000 units/day") needs the dose checked, so it's a doctor check
  const dose = /\b(greater|more|less) than|\bover|\babove|\bunder|\bbelow|[<>≤≥]/i.test(p.n) && /\d[\d,.]*\s*(units?|iu|mg|mcg|micrograms?|g)\b/i.test(p.n);
  return { cov, sug, guess: c.guess, o: p.o === 'd' || dose ? 'd' : 'x', win, rt: readRoutes(p.n) || readRoutes(p.w), ex: [], ask: !cov.i.length && !cov.g.length, conf: false };
}

/** The item as it stands: TST's confirmed version, else the pre-fill */
export function itemFor(s, p) {
  const saved = s && s.proItems && s.proItems[itemKey(p)];
  return saved ? { ...prefill(p), ...saved } : prefill(p);
}
/** What an item covers, as ingredient numbers */
export function coveredIngs(it) {
  const key = JSON.stringify([it.cov.i || [], it.cov.g || []]);
  if (COV.has(key)) return COV.get(key);
  if (COV.size > 2000) COV.clear();
  const out = new Set();
  COV.set(key, out);
  (it.cov.i || []).forEach((n) => { const i = ingIndex(n); if (i >= 0) out.add(i); });
  (it.cov.g || []).forEach((g) => membersOf(g).forEach((i) => out.add(i)));
  return out;
}
export function windowWords(win) {
  if (!win || win.k === 'none') return 'time window not stated';
  if (win.k === 'cur') return 'current use';
  if (win.k === 'ever') return 'ever used';
  return 'within ' + win.n + ' ' + (win.n === 1 ? UNIT_WORDS[win.u].replace(/s$/, '') : UNIT_WORDS[win.u]);
}
export const coverWords = (it) => [...(it.cov.g || []).map(groupName), ...(it.cov.i || [])].join(', ');

/* ---- dates and doses typed into the med log ---- */
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** The latest day a typed date could mean ("Mar 2026" → 31 Mar 2026), or null */
export function readDate(text, today = new Date()) {
  const t = norm(text);
  if (!t) return null;
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t))) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  if ((m = /^(?:(\d{1,2})\s+)?([a-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(t)) && m[2] in MON) return m[1] ? new Date(+m[3], MON[m[2]], +m[1]) : new Date(+m[3], MON[m[2]] + 1, 0);
  if ((m = /^(\d{4})$/.exec(t))) return new Date(+m[1], 11, 31);
  if ((m = /^(\d+|a|one|two|three|four|five|six)\s+(day|week|month|year)s?\s+ago$/.exec(t))) { const n = NUM[m[1]] || +m[1]; return new Date(today.getTime() - n * DAYS[UNIT[m[2]]] * 864e5); }
  if (/^yesterday$/.test(t)) return new Date(today.getTime() - 864e5);
  if (/^last week$/.test(t)) return new Date(today.getTime() - 7 * 864e5);
  if (/^last month$/.test(t)) return new Date(today.getFullYear(), today.getMonth(), 0);
  return null;
}
/** Milligrams in a typed dose ("40mg daily" → 40), or null */
export function readMg(text) {
  const m = /(\d+(?:\.\d+)?)\s*mg\b/.exec(norm(text));
  return m ? parseFloat(m[1]) : null;
}
const ago = (days) => (days < 14 ? Math.round(days) + ' days' : days < 60 ? Math.round(days / 7) + ' weeks' : days < 730 ? Math.round(days / 30.44) + ' months' : Math.round(days / 365.25) + ' years') + ' ago';

/**
 * Check one logged medicine against one study. Returns the strongest match, or null.
 * { n, w, o: 'x' exclude | 'd' doctor check | 'ok' cleared, why, via, it, key, conf }
 */
export function checkMed(e, s, today = new Date()) {
  const L = (s && s.pro && s.pro.med) || [];
  if (!L.length) return null;
  const r = resolve(e.n);
  const text = ' ' + norm([e.n, e.ind, e.dose, e.route].filter(Boolean).join(' ')) + ' ';
  const out = [];
  for (const p of L) {
    if ((e.nm || []).includes(p.n)) continue;
    const it = itemFor(s, p), key = itemKey(p);
    const base = { n: p.n, w: p.w, it, key, conf: !!it.conf };
    const covers = it.ask ? new Set() : coveredIngs(it);
    if (!covers.size) {
      // nothing RAYDAR can match by medicine: the bullet's own words, as in 2.6
      const k = p.k || [];
      if (k.length && k.some((w) => text.includes(w)) && !(p.no || []).some((w) => text.includes(w))) out.push({ ...base, o: it.o, why: 'Matched on the words of the list item', via: 'words' });
      continue;
    }
    if (!r) continue;
    const hit = r.ings.filter((i) => covers.has(i));
    if (!hit.length) continue;
    const via = hit.map(ingName).join(' + ') + ((it.cov.g || []).length ? ' (' + (it.cov.g || []).filter((g) => hit.some((i) => inGroup(i, g))).map(groupName).join(', ') + ')' : '');
    let o = it.o, why = [];
    // the form: an item for oral/injectable use doesn't exclude a cream outright
    if (it.rt) {
      const mine = routeOfText(e.route) || (r.routes.length === 1 ? r.routes : '');
      if (mine && !it.rt.includes(mine)) { o = 'd'; why.push('Listed for ' + routeWords(it.rt) + ' use; this is ' + routeWords(mine) + '. Doctor to check'); }
      else if (!mine && [...r.routes].some((x) => !it.rt.includes(x))) { if (o === 'x') o = 'd'; why.push('Listed for ' + routeWords(it.rt) + ' use. Ask how it\'s taken (it comes as ' + routeWords(r.routes) + ')'); }
    }
    // the time window, from the end date
    const win = it.win || { k: 'none' };
    const stopped = e.en ? readDate(e.en, today) : null;
    if (win.k === 'in' && e.en) {
      if (!stopped) { if (o === 'x') o = 'd'; why.push('Check when it was stopped ("' + e.en + '"): the list covers ' + windowWords(win)); }
      else {
        const days = (today - stopped) / 864e5, lim = win.n * DAYS[win.u];
        if (days > lim) { o = 'ok'; why = ['Stopped ' + ago(days) + ', outside the ' + windowWords(win).replace('within ', '') + ' window. Confirm the stop date']; }
        else why.push('Stopped ' + ago(Math.max(days, 0)) + ', inside the ' + windowWords(win).replace('within ', '') + ' window');
      }
    } else if (win.k === 'cur' && stopped && stopped < today) { if (o === 'x') o = 'd'; why.push('Stopped ' + ago((today - stopped) / 864e5) + '; the list is for current use. Check'); }
    // allowed doses
    for (const ex of it.ex || []) {
      const i = ingIndex(ex.i);
      if (i < 0 || !hit.includes(i) || o === 'ok') continue;
      const mg = readMg(e.dose) ?? readMg(e.n);
      if (mg == null) { o = 'd'; why.push(ex.i + ' is allowed up to ' + ex.mg + ' mg a day. Ask the dose'); }
      else if (mg <= ex.mg) { o = 'ok'; why = [mg + ' mg is within the allowed ' + ex.mg + ' mg a day']; }
      else why.push(mg + ' mg is over the allowed ' + ex.mg + ' mg a day');
    }
    out.push({ ...base, o, why: why.join('. '), via });
  }
  const rank = { x: 0, d: 1, ok: 2 };
  // same outcome: a confirmed item first, then one that states its time window
  const detail = (m) => (m.conf ? 0 : 2) + (m.it && m.it.win && m.it.win.k !== 'none' ? 0 : 1);
  out.sort((a, b) => rank[a.o] - rank[b.o] || detail(a) - detail(b));
  return out[0] || null;
}

/* Conditions: a possible match on the item's own words, never a decision */
const HX_STOP = new Set(('history known significant severe severely chronic active current currently recent condition conditions condtions disease diseases disorder disorders illness diagnosis diagnosed treatment treated unstable stable uncontrolled controlled moderate other including include includes unless within months weeks years prior previous participant investigator determined requiring required require clinically clinical relevant abnormal abnormalities abnormality any such based acute '
  + 'results result having useful affect affects affecting forms would ability handle related where needed another person recover which these those first following associated study assessments interfere interfering doctor shape family multiple major planned episode intervention procedure procedures fitted invasive there their about could should might other since ever been times problems problem issues issue types serious').split(' '));
const ACRONYM_STOP = new Set('PT PTS OK TST TL ID EG IE NB DR GP'.split(' '));
const stem = (w) => w.slice(0, Math.max(5, Math.min(w.length, 7)));
/** The words a condition item is matched on: the TST-set words, else its own longer words and acronyms (HIV, ECG) */
export function hxWords(p) {
  if (p.k && p.k.length) return p.k;
  const long = norm(p.n).split(/[^a-z0-9-]+/).filter((w) => w.length >= 5 && !HX_STOP.has(w)).map(stem);
  const acr = (String(p.n).match(/\b[A-Z]{2,6}\b/g) || []).filter((w) => !ACRONYM_STOP.has(w)).map((w) => w.toLowerCase());
  return [...new Set([...long, ...acr])];
}
export function checkHx(e, s) {
  const L = (s && s.pro && s.pro.hx) || [];
  if (!L.length) return null;
  const words = norm([e.n, e.ind].filter(Boolean).join(' ')).split(/[^a-z0-9-]+/).filter((w) => w.length >= 3).map(stem);
  if (!words.length) return null;
  for (const p of L) {
    if ((e.nm || []).includes(p.n)) continue;
    const k = hxWords(p);
    const hit = k.filter((w) => words.some((x) => (x.length >= 4 && w.length >= 4) ? x.startsWith(w) || w.startsWith(x) : x === w));
    if (hit.length) return { n: p.n, w: p.w, o: 'd', pm: true, why: 'Possible match on "' + hit.join('", "') + '". Check with the participant', key: itemKey(p) };
  }
  return null;
}

/** Medicines that match an item, for the study admin's preview */
export function itemMatches(it) {
  const d = dictionary(), ings = coveredIngs(it);
  if (!ings.size) return { ings: [], brands: [] };
  const brands = Object.entries(d.names).filter(([, v]) => v[3] === 'b' && v[0].some((i) => ings.has(i))).map(([k]) => k);
  return { ings: [...ings].map(ingName), brands };
}
