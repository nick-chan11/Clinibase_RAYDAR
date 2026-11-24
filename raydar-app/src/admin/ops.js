/* RAYDAR 2.8 study admin: editing an eSource (SurveyJS JSON) the way TST's tool stores it, so a study built here opens
   in their tool and the other way round. Element paths: [page, index, child index…] (panels hold elements). */
import { outcomeOf, plain } from '../esource/convert.js';
import { compile } from '../esource/expr.js';

export const clone = (x) => JSON.parse(JSON.stringify(x));
export const isNotesPage = (p) => /study\s*notes?/i.test((p && (p.title || p.name)) || '');
export const pageName = (p, i) => plain((p && (p.title || p.name)) || '') || 'Section ' + (i + 1);

/* ---- paths ---- */
export function listAt(json, cpath) {
  let list = json.pages[cpath[0]].elements = json.pages[cpath[0]].elements || [];
  for (let k = 1; k < cpath.length; k++) list = list[cpath[k]].elements = list[cpath[k]].elements || [];
  return list;
}
export function elAt(json, path) {
  const list = listAt(json, path.slice(0, -1));
  return list[path[path.length - 1]];
}
export function removeAt(json, path) {
  return listAt(json, path.slice(0, -1)).splice(path[path.length - 1], 1)[0];
}
export function insertAt(json, cpath, index, el) {
  const list = listAt(json, cpath);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, el);
}
/** Move an element; returns its new path */
export function move(json, from, toC, toI) {
  const same = from.length - 1 === toC.length && from.slice(0, -1).every((x, i) => x === toC[i]);
  // can't drop a panel inside itself
  if (toC.length >= from.length && from.every((x, i) => x === toC[i])) return from;
  const el = removeAt(json, from);
  let i = toI;
  if (same && from[from.length - 1] < toI) i--;
  insertAt(json, toC, i, el);
  return toC.concat(i);
}
/** Every element with its path, depth-first (panels' children after the panel) */
export function walk(json, fn) {
  (json.pages || []).forEach((p, pi) => {
    const go = (list, cpath) => (list || []).forEach((el, i) => { const path = cpath.concat(i); fn(el, path, pi); if (el.type === 'panel') go(el.elements, path); });
    go(p.elements, [pi]);
  });
}
export function findPath(json, name) {
  let hit = null;
  walk(json, (el, path) => { if (!hit && el.name === name) hit = path; });
  return hit;
}
export function allNames(json) {
  const s = new Set();
  walk(json, (el) => { if (el.name) s.add(el.name); (el.templateElements || []).forEach((t) => t.name && s.add(t.name)); });
  return s;
}
/** TST style names: question1, question2… */
export function newName(json, base) {
  const names = allNames(json);
  if (base && !names.has(base)) return base;
  let n = 1;
  names.forEach((x) => { const m = /^question(\d+)$/.exec(x); if (m) n = Math.max(n, +m[1] + 1); });
  while (names.has('question' + n)) n++;
  return 'question' + n;
}

/* ---- answers and their outcomes (the eSource's emoji markers) ---- */
const MARKS = /\s*(✅|⚠️|⚠|🛑|🚫|❌|⛔)️?\s*/gu;
export const OUTCOMES = [['c', 'Continue', '✅'], ['d', 'Doctor check', '⚠️'], ['delay', 'Delay', '⚠️'], ['x', 'Exclude', '🛑'], ['i', 'Info only (no marker)', '']];
export function outcomeKey(text) {
  const o = outcomeOf(String(text || ''));
  if (o === 'd') return /delay/i.test(text) ? 'delay' : 'd';
  return o || 'i';
}
export const bareText = (text) => String(text || '').replace(MARKS, ' ').replace(/\s+/g, ' ').trim();
export function withOutcome(text, key) {
  const o = OUTCOMES.find((x) => x[0] === key);
  const t = bareText(text);
  return o && o[2] ? t + ' ' + o[2] : t;
}
export function choicesOf(el) {
  if (el.type === 'boolean') return [{ value: true, text: el.labelTrue || 'Yes' }, { value: false, text: el.labelFalse || 'No' }];
  return (el.choices || []).map((c) => (c !== null && typeof c === 'object' ? { value: c.value, text: c.text != null ? c.text : String(c.value) } : { value: c, text: String(c) }));
}
/** Store choices as {value, text} objects, the way TST's tool exports them */
export function setChoices(el, list) { el.choices = list.map((c) => ({ value: c.value, text: c.text })); }
export function newValue(el) {
  const used = new Set(choicesOf(el).map((c) => String(c.value)));
  let n = 1; while (used.has('Item ' + n)) n++;
  return 'Item ' + n;
}
export const CHOICE_TYPES = new Set(['radiogroup', 'checkbox', 'dropdown', 'tagbox', 'boolean']);

/* ---- new blocks ---- */
export const PALETTE = [
  ['yesno', 'Yes / No question', 'Each answer gets an outcome'],
  ['pick', 'Pick one', 'Several answers, one chosen'],
  ['multi', 'Tick all that apply', ''],
  ['text', 'Typed answer', ''],
  ['dob', 'Date of birth and age', 'Age range feeds Quick check'],
  ['bmi', 'Height, weight and BMI', 'BMI range feeds Quick check'],
  ['medlog', 'Medication log', ''],
  ['hxlog', 'Medical history log', ''],
  ['note', 'Recruiter note', 'Shown beside the question above it'],
  ['section', 'New section', 'A new page of questions'],
];
export function newElement(kind, json) {
  const name = newName(json);
  const ch = (t) => ({ value: 'Item ' + t[0], text: t[1] });
  switch (kind) {
    case 'yesno': return { type: 'radiogroup', name, title: 'New question', isRequired: true, choices: [ch([1, 'No - continue ✅']), ch([2, 'Yes - continue ✅'])] };
    case 'pick': return { type: 'radiogroup', name, title: 'New question', isRequired: true, choices: [ch([1, 'Option 1 ✅']), ch([2, 'Option 2 ✅']), ch([3, 'Option 3 ✅'])] };
    case 'multi': return { type: 'checkbox', name, title: 'New question', choices: [ch([1, 'Option 1 ✅']), ch([2, 'Option 2 ✅']), ch([3, 'None of these ✅'])] };
    case 'text': return { type: 'text', name, title: 'New question' };
    case 'dob': return { type: 'dobandage', name: newName(json, 'Age'), title: 'Can you please confirm your date of birth?' };
    case 'bmi': return { type: 'bmi', name: newName(json, 'BMI'), title: 'To calculate your BMI, can you please confirm your height and weight?' };
    case 'medlog': return { type: 'paneldynamic', name, title: 'Are you currently taking any medications, supplements or vitamins?', templateElements: [
      { type: 'text', name: name + '_name', title: 'Medication name' }, { type: 'text', name: name + '_ind', title: 'Indication (what for)' },
      { type: 'text', name: name + '_dose', title: 'Dose' }, { type: 'text', name: name + '_start', title: 'Start date' }, { type: 'text', name: name + '_end', title: 'End date, if stopped' }] };
    case 'hxlog': return { type: 'paneldynamic', name, title: 'Do you have any medical conditions, or have you had any in the past?', templateElements: [
      { type: 'text', name: name + '_cond', title: 'Condition or event' }, { type: 'text', name: name + '_dx', title: 'Date diagnosed' }, { type: 'text', name: name + '_res', title: 'Date resolved, if resolved' }] };
    case 'note': return { type: 'html', name, html: '<p>Recruiter note</p>' };
    default: return null;
  }
}
/** A saved block put back into a study: every name made unique, conditions inside it follow */
export function renameBlock(json, els) {
  const copy = clone(els), map = {};
  const names = allNames(json);
  const fresh = () => { let n = 1; names.forEach((x) => { const m = /^question(\d+)$/.exec(x); if (m) n = Math.max(n, +m[1] + 1); }); while (names.has('question' + n)) n++; names.add('question' + n); return 'question' + n; };
  const visit = (list) => list.forEach((el) => { if (el.name) { const nn = names.has(el.name) ? fresh() : el.name; names.add(nn); map[el.name] = nn; el.name = nn; } if (el.elements) visit(el.elements); });
  visit(copy);
  const fix = (s) => String(s).replace(/\{([^}]+)\}/g, (m, n) => { const b = n.split('.')[0].trim(); return map[b] ? '{' + n.replace(b, map[b]) + '}' : m; });
  const fixAll = (list) => list.forEach((el) => { if (el.visibleIf) el.visibleIf = fix(el.visibleIf); if (el.elements) fixAll(el.elements); });
  fixAll(copy);
  return copy;
}

/* ---- "Only when" (visibleIf) in plain parts ---- */
const Q = "'((?:[^'\\\\]|\\\\.)*)'";
/** "{q} = 'Item 1' or {q} anyof ['Item 1','Item 2']" → { join, rows: [{ q, vals }] }, or null when it's more complex */
export function parseWhen(src) {
  const s = String(src || '').trim();
  if (!s) return { join: 'or', rows: [] };
  const hasAnd = /\s+and\s+/i.test(s), hasOr = /\s+or\s+/i.test(s);
  if (hasAnd && hasOr) return null;
  const parts = s.replace(/^\((.*)\)$/, '$1').split(/\s+(?:and|or)\s+/i);
  const rows = [];
  for (const p0 of parts) {
    const p = p0.trim().replace(/^\((.*)\)$/, '$1').trim();
    let m = new RegExp('^\\{([^}]+)\\}\\s*(?:=|==)\\s*' + Q + '$').exec(p);
    if (m) { rows.push({ q: m[1].trim(), vals: [m[2]] }); continue; }
    m = new RegExp('^\\{([^}]+)\\}\\s*contains\\s*' + Q + '$', 'i').exec(p);
    if (m) { rows.push({ q: m[1].trim(), vals: [m[2]], contains: true }); continue; }
    m = /^\{([^}]+)\}\s*anyof\s*\[(.*)\]$/i.exec(p);
    if (m) { rows.push({ q: m[1].trim(), vals: [...m[2].matchAll(new RegExp(Q, 'g'))].map((x) => x[1]) }); continue; }
    m = /^\{([^}]+)\}\s*(?:=|==)\s*(true|false)$/i.exec(p);
    if (m) { rows.push({ q: m[1].trim(), vals: [m[2].toLowerCase() === 'true'] }); continue; }
    return null;
  }
  return { join: hasAnd ? 'and' : 'or', rows };
}
const lit = (v) => (typeof v === 'boolean' ? String(v) : "'" + String(v).replace(/'/g, "\\'") + "'");
export function buildWhen(w) {
  const rows = (w.rows || []).filter((r) => r.q && r.vals && r.vals.length);
  if (!rows.length) return '';
  return rows.map((r) => (r.contains ? '{' + r.q + '} contains ' + lit(r.vals[0]) : r.vals.length === 1 ? '{' + r.q + '} = ' + lit(r.vals[0]) : '{' + r.q + '} anyof [' + r.vals.map(lit).join(', ') + ']')).join(' ' + (w.join || 'or') + ' ');
}
/** visibleIf in words: "Shows when “Sex” is Female" */
export function whenWords(json, src) {
  if (!src) return '';
  const w = parseWhen(src);
  const byName = {};
  walk(json, (el) => { if (el.name) byName[el.name] = el; });
  const qn = (n) => { const e = byName[n.split('.')[0]]; return '“' + (e ? short(plain(e.title || e.name), 40) : n) + '”'; };
  if (!w) return 'Shows when: ' + src;
  return 'Shows when ' + w.rows.map((r) => { const e = byName[r.q]; const ch = e ? choicesOf(e) : []; const lab = (v) => { const c = ch.find((x) => String(x.value) === String(v)); return c ? '“' + short(bareText(plain(c.text)), 40) + '”' : String(v); }; return qn(r.q) + (r.contains ? ' includes ' : ' is ') + r.vals.map(lab).join(' or '); }).join(w.join === 'and' ? ', and ' : '; or ');
}
export const whenError = (src) => (src ? compile(src).error || '' : '');
export const short = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

/* ---- age range: a red exclusion note RAYDAR reads (as TST do it) ---- */
export function ageRange(json, ageName) {
  const note = findPath(json, ageName + '_range');
  if (!note) return null;
  const el = elAt(json, note), m = /\{[^}]+\}\s*<\s*(\d+)\s*or\s*\{[^}]+\}\s*>\s*(\d+)/.exec(el.visibleIf || '');
  return m ? [+m[1], +m[2]] : null;
}
export function setAgeRange(json, path, lo, hi) {
  const ageEl = elAt(json, path), nm = ageEl.name + '_range';
  const at = findPath(json, nm);
  if (!(lo > 0) || !(hi > lo)) { if (at) removeAt(json, at); return; }
  const note = { type: 'html', name: nm, visibleIf: '{' + ageEl.name + '} < ' + lo + ' or {' + ageEl.name + '} > ' + hi, html: '<p><span style="color: rgb(255, 0, 0);">Outside the age range (' + lo + ' to ' + hi + '). Please exclude. 🛑</span></p>' };
  if (at) Object.assign(elAt(json, at), note);
  else insertAt(json, path.slice(0, -1), path[path.length - 1] + 1, note);
}

/* ---- a new study ---- */
export function newStudy(code, title) {
  return {
    title: (title || code) + ' Pre-screening Questions',
    pages: [
      { name: 'Study Notes', title: 'Study Notes', elements: [{ type: 'html', name: 'question1', html: '<p><strong>Protocol:</strong> ' + code + '</p><p>Write the study notes and call script here.</p>' }] },
      { name: 'Demographics', title: 'Demographics', elements: [
        { type: 'radiogroup', name: 'Sex', title: 'What is your sex assigned at birth?', isRequired: true, choices: [{ value: 'Item 1', text: 'Male' }, { value: 'Item 2', text: 'Female' }] },
        { type: 'dobandage', name: 'Age', title: 'Can you please confirm your date of birth?' },
        { type: 'bmi', name: 'BMI', title: 'To calculate your BMI, can you please confirm your height and weight?' },
      ] },
    ],
  };
}
