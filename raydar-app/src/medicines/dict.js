/* The medicines dictionary (../RAYDAR medicines.json, built by `npm run dict:update` from the AMT and PBS).
   It only recognises names: a brand or an ingredient leads to its active ingredients and their drug groups.
   It never decides what's prohibited; a study's eSource does (src/medicines/items.js).
   A studies folder can carry a newer dictionary; useDictionary() swaps it in. */
import BUILT from '../../../RAYDAR medicines.json';

let D = null, IDX = null;
const RES = new Map(); // name lookups, cleared when the dictionary changes
const listeners = new Set();
export const onDictionaryChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

export function useDictionary(d) {
  if (!d || !d.names || !d.ing || !d.groups) return false;
  D = d; IDX = null; RES.clear();
  listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  return true;
}
useDictionary(BUILT);
export const dictionary = () => D;
export const dictVersion = () => (D && D.version) || {};

const SALT = /\b(sodium|potassium|calcium|magnesium|hydrochloride|hydrobromide|phosphate|sulfate|sulphate|acetate|maleate|mesilate|mesylate|tartrate|citrate|fumarate|succinate|besilate|bromide|dihydrate|monohydrate|hemihydrate|trihydrate|anhydrous|disodium|dipropionate|propionate|valerate|furoate|hyclate|lactate|gluconate|nitrate|benzoate|embonate|decanoate|enantate|undecanoate|medoxomil|cilexetil|axetil)\b/g;
export const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%+/'.\- ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* name → { i: [ingredient numbers], r: routes, f: forms, t: 'b' brand | 'i' ingredient | 'a' alias } */
function index() {
  if (IDX) return IDX;
  const map = new Map();
  const put = (k, v) => { if (k && k.length > 1 && !map.has(k)) map.set(k, v); };
  Object.entries(D.names).forEach(([k, v]) => map.set(k, { i: v[0], r: v[1] || '', f: v[2] || [], t: v[3] || 'b' }));
  D.ing.forEach((x, i) => {
    const n = x[0];
    put(n, { i: [i], r: '', f: [], t: 'i' });
    // other ways the same ingredient is written: without the salt ("dexamethasone phosphate" → dexamethasone),
    // and both names of "adrenaline (epinephrine)"
    const plain = n.replace(/\(([^)]*)\)/g, ' ').replace(SALT, ' ').replace(/\s+/g, ' ').trim();
    if (plain && plain !== n && !/ \+ /.test(n)) put(plain, { i: [i], r: '', f: [], t: 'i' });
    const m = /^(.*?)\s*\(([^)]*)\)$/.exec(n);
    if (m && !/ \+ /.test(n)) { put(m[1].trim(), { i: [i], r: '', f: [], t: 'i' }); put(m[2].trim(), { i: [i], r: '', f: [], t: 'i' }); }
  });
  const keys = [...map.keys()].sort();
  const longest = keys.reduce((n, k) => Math.max(n, k.split(' ').length), 1);
  IDX = { map, keys, longest: Math.min(longest, 6) };
  return IDX;
}

export const ingName = (i) => (D.ing[i] || [])[0] || '';
export const ingCodes = (i) => (D.ing[i] || []).slice(1);
export const groupName = (c) => D.groups[c] || c;
export const ingIndex = (name) => { const e = index().map.get(norm(name)); return e && e.t !== 'b' && e.i.length === 1 ? e.i[0] : -1; };
/** Does ingredient i belong to a group? ATC codes match every code under them (C10AA covers C10AA05). */
export const inGroup = (i, g) => ingCodes(i).some((c) => (g.startsWith('x-') ? c === g : c.startsWith(g)));
/** Every ingredient in a group */
export const membersOf = (g) => D.ing.map((x, i) => i).filter((i) => inGroup(i, g));
/** The clearest group name for an ingredient: the narrow ATC group (5 characters), else RAYDAR's own, else broader */
export function mainGroups(i, n = 2) {
  const cs = ingCodes(i), out = [];
  cs.filter((c) => c.startsWith('x-')).forEach((c) => out.push(c));
  cs.filter((c) => !c.startsWith('x-')).forEach((c) => { for (const len of [5, 4, 3]) { const k = c.slice(0, len); if (D.groups[k]) { out.push(k); break; } } });
  return [...new Set(out)].slice(0, n);
}
const ROUTE_WORDS = { o: 'by mouth', i: 'injection', h: 'inhaled', n: 'nasal', e: 'eye or ear', t: 'on the skin', v: 'vaginal or rectal', s: 'patch' };
export const routeWords = (r) => [...String(r || '')].map((c) => ROUTE_WORDS[c]).filter(Boolean).join(', ');
/** A recruiter's route ("Oral", "cream", "puffer") as a route letter */
export function routeOfText(t) {
  const s = norm(t);
  if (!s) return '';
  if (/inhal|puffer|nebul|turbuhaler|vape|vapori|smok/.test(s)) return 'h';
  if (/nasal|nose/.test(s)) return 'n';
  if (/eye|ear|ophthal/.test(s)) return 'e';
  if (/inject|infus|\biv\b|\bim\b|subcut|\bsc\b|intraven|intramusc|jab|pen\b/.test(s)) return 'i';
  if (/patch|transderm/.test(s)) return 's';
  if (/pessar|vagin|rectal|supposit|enema/.test(s)) return 'v';
  if (/cream|ointment|gel\b|lotion|shampoo|topical|skin|scalp|wash|spray/.test(s)) return 't';
  if (/oral|mouth|tablet|capsule|liquid|syrup|pill|swallow|sublingual|chew/.test(s)) return 'o';
  return '';
}
export const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

/**
 * What a typed name is: the longest dictionary names found in it, word by word.
 * "Lipitor 40mg" → Lipitor → atorvastatin; "Panamax Co" → paracetamol + codeine.
 * Returns null when nothing in it is recognised.
 */
export function resolve(text) {
  const key = String(text || '');
  if (RES.has(key)) return RES.get(key);
  if (RES.size > 3000) RES.clear();
  const r = resolveNow(key);
  RES.set(key, r);
  return r;
}
function resolveNow(text) {
  const { map, longest } = index();
  const words = norm(text).split(' ').filter(Boolean);
  const found = [];
  for (let s = 0; s < words.length;) {
    let hit = null;
    for (let n = Math.min(longest, words.length - s); n >= 1; n--) {
      const k = words.slice(s, s + n).join(' ');
      if (map.has(k) && (n > 1 || k.length >= 3)) { hit = { k, n, e: map.get(k) }; break; }
    }
    if (hit) { found.push(hit); s += hit.n; } else s++;
  }
  if (!found.length) return null;
  const ings = [...new Set(found.flatMap((h) => h.e.i))];
  const routes = [...new Set(found.flatMap((h) => [...h.e.r]))].join('');
  const first = found[0];
  return { name: first.k, type: first.e.t, names: found.map((h) => h.k), ings, routes, forms: first.e.f };
}

/* Damerau-Levenshtein distance, stopping early past max */
function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let row = max + 1;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      row = Math.min(row, d[i][j]);
    }
    if (row > max) return max + 1;
  }
  return d[a.length][b.length];
}

function entryOut(k, e) {
  const i = e.i[0];
  return { name: k, label: e.t === 'b' || e.t === 'a' ? cap(k) : k, type: e.t, ings: e.i.map(ingName), groups: e.i.length === 1 ? mainGroups(i, 1).map(groupName) : [], forms: e.f, routes: e.r };
}

/** Names starting with what's been typed, then close spellings. Brands and ingredients, for the med log. */
export function suggest(q, n = 6) {
  const { map, keys } = index();
  const s = norm(q);
  if (s.length < 2) return [];
  let lo = 0, hi = keys.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (keys[m] < s) lo = m + 1; else hi = m; }
  const out = [], seen = new Set();
  for (let k = lo; k < keys.length && keys[k].startsWith(s) && out.length < 40; k++) out.push(keys[k]);
  // shorter names first ("lipitor" before "lipitor 20"), brands and ingredients mixed
  out.sort((a, b) => a.length - b.length || a.localeCompare(b));
  const res = [];
  for (const k of out) {
    const e = map.get(k), sig = e.i.join(',') + '|' + k.split(' ')[0];
    if (seen.has(sig)) continue;
    seen.add(sig); res.push(entryOut(k, e));
    if (res.length >= n) return res;
  }
  if (s.length >= 4 && res.length < 3) close(s, n - res.length).forEach((x) => { if (!res.some((r) => r.name === x.name)) res.push(x); });
  return res;
}

/** Close spellings of a typed name: "atorvastaten" → atorvastatin */
export function close(q, n = 3) {
  const { map, keys } = index();
  const s = norm(q);
  if (s.length < 4) return [];
  const max = s.length > 7 ? 2 : 1, out = [];
  for (const k of keys) {
    if (k[0] !== s[0] && k[1] !== s[1]) continue;
    const head = k.slice(0, s.length);
    const d = Math.min(dist(s, head, max), dist(s, k, max));
    if (d <= max) out.push([d, k]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1].length - b[1].length);
  const res = [], seen = new Set();
  for (const [, k] of out) { const e = map.get(k); const sig = e.i.join(','); if (seen.has(sig)) continue; seen.add(sig); res.push(entryOut(k, e)); if (res.length >= n) break; }
  return res;
}

/** One line about what a name is: "atorvastatin · HMG CoA reductase inhibitors" */
export function describe(r) {
  if (!r) return '';
  const g = r.ings.length === 1 ? [...new Set(mainGroups(r.ings[0], 3).map(groupName))].slice(0, 2) : [];
  return r.ings.map(ingName).join(' + ') + (g.length ? ' · ' + g.join(', ') : '');
}
