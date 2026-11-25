// npm run dict:update  [-- --from <folder>]
// Builds RAYDAR's medicines dictionary (../RAYDAR medicines.json) from:
//   amt-YYYYMMDD.csv            the AMT flat file (NCTS): every active product, brand → generic → active ingredient
//   amt-items.csv               PBS: PBS item → AMT concepts
//   item-atc-relationships.csv  PBS: PBS item → ATC code
//   atc-codes.csv               PBS: ATC code → name, level, parent
//   ../RAYDAR medicine extras.json  hand-kept aliases, herbal ingredients, RAYDAR's own groups
// The source files are large and licensed, so they stay outside the repo: by default in the folder that holds the repo
// (e.g. "Clinibase RAYDAR/"). Prints what changed since the last build.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO } from './lib/common.mjs';

const OUT = path.join(REPO, 'RAYDAR medicines.json');
const EXTRAS = path.join(REPO, 'RAYDAR medicine extras.json');
const argFrom = process.argv.indexOf('--from');
const FROM = argFrom > 0 ? path.resolve(process.argv[argFrom + 1]) : path.resolve(REPO, '..');

/* ---------- CSV ---------- */
function csv(file) {
  const s = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] === 'null' ? '' : r[i] || ''])));
}
function need(name) {
  const p = path.join(FROM, name);
  if (!existsSync(p)) { console.error('Missing ' + p + '\nDownload it (see "HOW TO USE THE RAYDAR SKILLS.md") or pass --from <folder>.'); process.exit(1); }
  return p;
}
const amtFile = readdirSync(FROM).filter((f) => /^amt-\d{8}\.csv$/i.test(f)).sort().pop();
if (!amtFile) { console.error('No AMT file (amt-YYYYMMDD.csv) in ' + FROM); process.exit(1); }
const amtDate = amtFile.replace(/^amt-(\d{4})(\d{2})(\d{2})\.csv$/i, '$1-$2-$3');

console.log('Reading ' + FROM);
const amt = csv(path.join(FROM, amtFile));
const pbsItems = csv(need('amt-items.csv'));
const rel = csv(need('item-atc-relationships.csv'));
const atc = csv(need('atc-codes.csv'));
const extras = JSON.parse(readFileSync(EXTRAS, 'utf8'));
const schedules = new Set([...pbsItems, ...rel, ...atc].map((r) => r.schedule_code));
if (schedules.size > 1) console.warn('! The three PBS files come from different schedules (' + [...schedules].join(', ') + '). Download them from the same month.');
const pbsSchedule = [...schedules][0] || '';

/* ---------- ATC ---------- */
const ATC = new Map(atc.map((r) => [r.atc_code, r]));
const nice = (d) => (d === d.toUpperCase() ? d.charAt(0) + d.slice(1).toLowerCase() : d);
const byAtcName = new Map();
atc.filter((r) => r.atc_level === '5').forEach((r) => { const k = r.atc_description.toLowerCase(); (byAtcName.get(k) || byAtcName.set(k, []).get(k)).push(r.atc_code); });
const SALT = /\b(sodium|potassium|calcium|magnesium|hydrochloride|hydrobromide|phosphate|sulfate|sulphate|acetate|maleate|mesilate|mesylate|tartrate|citrate|fumarate|succinate|besilate|bromide|dihydrate|monohydrate|hemihydrate|trihydrate|anhydrous|disodium|dipropionate|propionate|valerate|butyrate|furoate|hyclate|lactate|gluconate|nitrate|tromethamine|meglumine|benzoate|pivalate|embonate|decanoate|enantate|undecanoate|medoxomil|cilexetil|axetil)\b/g;
const bare = (n) => n.replace(/\(([^)]*)\)/g, ' ').replace(SALT, ' ').replace(/\s+/g, ' ').trim();
const byBareName = new Map();
for (const [k, v] of byAtcName) { const b = bare(k); if (b) (byBareName.get(b) || byBareName.set(b, []).get(b)).push(...v); }

/* ---------- ingredients and names from AMT ---------- */
const lc = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const isVaccine = (n) => /vaccine|meran$|mycobacterium bovis/.test(n);
const split = (mp) => (isVaccine(lc(mp)) && / \+ /.test(mp) && /vaccine/.test(lc(mp)) ? [lc(mp)] : mp.split(' + ').map(lc));
const ING = new Map(); // name → Set(codes)
const ingOf = (n) => ING.get(n) || ING.set(n, new Set()).get(n);
const mpParts = new Map(); // MP SCTID → [ingredient]
const ROUTES = [
  ['i', /injection|infusion|syringe|\bpen\b|vial|implant|intravesical|intravenous|subcutaneous|intramuscular/],
  ['h', /inhalation|inhaler|actuation|nebuli|turbuhaler|accuhaler|ellipta|for vaporisation|dried herb/],
  ['n', /nasal/],
  ['e', /eye |ear |eye$|ear$|ophthalmic|otic/],
  ['v', /pessary|vaginal|suppository|rectal|enema|intrauterine/],
  ['s', /transdermal|patch/],
  ['t', /cream|ointment|gel\b|lotion|shampoo|topical|paint|foam|solution, scalp|application|cutaneous|wash|mouthwash|lozenge|dressing|plaster|spray(?!.*nasal)|powder$|stick|scalp/],
  ['o', /tablet|capsule|oral|sachet|granules|chewing|sublingual|wafer|syrup|elixir|drops$|powder for oral|liquid|mixture|soluble|effervescent|gum|pastille|film/],
];
const routeOf = (form) => { const f = form.toLowerCase(); for (const [k, re] of ROUTES) if (re.test(f)) return k; return ''; };
const NAMES = new Map(); // name → { i:Set, r:Set, f:Set, t }
function addName(name, ings, form, t) {
  if (!name || name.length < 2) return;
  const e = NAMES.get(name) || NAMES.set(name, { i: new Set(), r: new Set(), f: new Set(), t }).get(name);
  ings.forEach((x) => e.i.add(x));
  if (form) { const r = routeOf(form); if (r) e.r.add(r); if (e.f.size < 5 && form.length <= 48) e.f.add(form); }
}
let inert = 0;
for (const r of amt) {
  if (/^inert substance$/i.test(r['MP PT'])) { inert++; continue; }
  const parts = split(r['MP PT']);
  mpParts.set(r['MP SCTID'], parts);
  parts.forEach(ingOf);
  // the strength and form, without the ingredient name in front ("Atorvastatin 40 mg tablet" → "40 mg tablet")
  const mpuu = r['MPUU PT'];
  const form = parts.length === 1 && mpuu.toLowerCase().startsWith(parts[0]) ? mpuu.slice(parts[0].length).trim() : mpuu;
  for (const raw of new Set([r['TPP TP PT'], r['TPUU TP PT']])) {
    const n = lc(raw);
    // generic copies ("Atorvastatin (APO)") are found by their ingredient, so they aren't kept as names
    const m = /^(.*?)\s*\(([^)]*)\)$/.exec(n);
    if (m && parts.some((p) => bare(p) === bare(m[1]) || p === m[1])) { parts.forEach((p) => addName(p, [p], form, 'i')); continue; }
    addName(n, parts, form, 'b');
  }
  parts.forEach((p) => addName(p, [p], parts.length === 1 ? form : '', 'i'));
}

/* ---------- groups: PBS (exact, by AMT id), then ATC name, then RAYDAR's rules ---------- */
const itemMp = new Map();
for (const r of pbsItems) if (r.concept_type_code === 'MP') { const k = r.li_item_id.split('_')[0]; (itemMp.get(k) || itemMp.set(k, new Set()).get(k)).add(r.amt_code); }
const src = new Map();
for (const r of rel) for (const mp of itemMp.get(r.pbs_code) || []) {
  const p = mpParts.get(mp);
  if (p && p.length === 1 && ATC.has(r.atc_code)) { ING.get(p[0]).add(r.atc_code); src.set(p[0], 'pbs'); }
}
for (const [n, codes] of ING) {
  if (codes.size) continue;
  const hit = byAtcName.get(n) || byBareName.get(bare(n));
  if (hit) { hit.forEach((c) => codes.add(c)); src.set(n, 'atc'); }
}
const live = new Set(extras.liveVaccines.live.map((x) => lc(x.name))), notLive = new Set(extras.liveVaccines.notLive.map((x) => lc(x.name)));
for (const [n, codes] of ING) {
  if (isVaccine(n)) { codes.add('x-vaccine'); if (/meran$|mrna/.test(n)) codes.add('x-vaccine-mrna'); if ((/\blive\b/.test(n) || live.has(n)) && !notLive.has(n)) codes.add('x-vaccine-live'); }
  if (/cannabi|tetrahydrocannabi/.test(n)) { codes.add('x-cannabis'); if (/tetrahydrocannabi/.test(n)) codes.add('x-cannabis-thc'); }
  if (/immunoglobulin|gamma globulin/.test(n) && ![...codes].some((c) => c.startsWith('J06'))) codes.add('J06B');
}

/* ---------- extras ---------- */
const problems = [];
for (const x of extras.ingredients || []) { const n = lc(x.name); (x.groups || []).forEach((g) => ingOf(n).add(g)); ingOf(n); addName(n, [n], '', 'i'); src.set(n, 'extras'); }
for (const x of extras.aliases || []) {
  const to = (x.to || []).map(lc).filter((t) => { if (!ING.has(t)) problems.push('Alias "' + x.name + '" points at "' + t + '", which isn\'t an ingredient in the dictionary'); return ING.has(t); });
  if (to.length) addName(lc(x.name), to, '', 'a');
}
for (const g of extras.groupWords || []) for (const c of g.groups) if (!c.startsWith('x-') && !ATC.has(c)) problems.push('groupWords "' + g.words + '": ATC code ' + c + ' isn\'t in atc-codes.csv');

/* ---------- write ---------- */
const ingList = [...ING.keys()].sort();
const idx = new Map(ingList.map((n, i) => [n, i]));
const used = new Set();
const ing = ingList.map((n) => { const codes = [...ING.get(n)].sort(); codes.forEach((c) => { let k = c; while (k && ATC.has(k)) { used.add(k); k = ATC.get(k).atc_parent_code; } if (c.startsWith('x-')) used.add(c); }); return [n, ...codes]; });
const groups = {};
[...used].sort().forEach((c) => {
  if (c.startsWith('x-')) groups[c] = (extras.groups[c] || {}).name || c;
  else groups[c] = nice(ATC.get(c).atc_description);
});
const names = {};
[...NAMES.keys()].sort().forEach((n) => {
  const e = NAMES.get(n);
  if (e.t === 'i' && e.i.size === 1 && e.i.has(n) && !e.f.size) return; // a bare ingredient is found through the ingredient list
  names[n] = [[...e.i].map((x) => idx.get(x)), [...e.r].sort().join(''), [...e.f].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)), e.t];
});
const out = {
  _about: 'RAYDAR medicines dictionary. Built by `npm run dict:update` from the AMT (NCTS) and PBS files, plus RAYDAR medicine extras.json. Do not edit by hand. names: name → [ingredient numbers, routes (o oral, i injection, h inhaled, n nasal, e eye/ear, t skin, v vaginal/rectal, s patch), forms, type (b brand, i ingredient, a alias)]. ing: [name, ATC codes (a group matches every code starting with it), RAYDAR groups (x-)]. groups: code → name.',
  version: { amt: amtDate, pbs: pbsSchedule, extras: extras.version || '', built: new Date().toISOString().slice(0, 10) },
  groups, ing, names,
};

let prev = null;
try { prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) { /* first build */ }
writeFileSync(OUT, JSON.stringify(out) + '\n');

/* ---------- report ---------- */
const grouped = ing.filter((x) => x.length > 1).length;
const brands = Object.values(names).filter((v) => v[3] === 'b');
const brandGrouped = brands.filter((v) => v[0].some((i) => ing[i].length > 1)).length;
console.log('\nRAYDAR medicines.json written (' + Math.round(JSON.stringify(out).length / 1024) + ' KB)');
console.log('  AMT ' + amtDate + ', PBS schedule ' + pbsSchedule + ', extras ' + (extras.version || '(no version)'));
console.log('  ' + ingList.length + ' ingredients: ' + [...src.values()].filter((v) => v === 'pbs').length + ' grouped from the PBS, ' + [...src.values()].filter((v) => v === 'atc').length + ' by ATC name, ' + (grouped - [...src.values()].filter((v) => v === 'pbs' || v === 'atc').length) + ' by RAYDAR rules or extras only, ' + (ingList.length - grouped) + ' with no group');
console.log('  ' + brands.length + ' brand names, ' + brandGrouped + ' (' + Math.round(100 * brandGrouped / brands.length) + '%) with a drug group. ' + inert + ' placebo rows left out.');
console.log('  Live vaccines: ' + ing.filter((x) => x.includes('x-vaccine-live')).map((x) => x[0]).join('; '));
if (prev) {
  const pn = new Set(Object.keys(prev.names)), nn = new Set(Object.keys(names));
  const added = [...nn].filter((n) => !pn.has(n)), gone = [...pn].filter((n) => !nn.has(n));
  const pg = new Map(prev.ing.map((x) => [x[0], x.slice(1).join(',')]));
  const changed = ing.filter((x) => pg.has(x[0]) && pg.get(x[0]) !== x.slice(1).join(','));
  console.log('\nSince the last build (' + (prev.version && prev.version.built) + '):');
  console.log('  ' + added.length + ' names added' + (added.length ? ': ' + added.slice(0, 15).join(', ') + (added.length > 15 ? '…' : '') : ''));
  console.log('  ' + gone.length + ' names removed' + (gone.length ? ': ' + gone.slice(0, 15).join(', ') + (gone.length > 15 ? '…' : '') : ''));
  console.log('  ' + changed.length + ' ingredients changed group' + (changed.length ? ': ' + changed.slice(0, 15).map((x) => x[0]).join(', ') : ''));
}
if (problems.length) { console.log('\nTo fix in RAYDAR medicine extras.json:'); problems.forEach((p) => console.log('  ! ' + p)); }
console.log('\nNext: npm run test:medicines, then rebuild RAYDAR (npm run build:all).');
