/* eSource → RAYDAR (2.5). Reads one TST pre-screening eSource (a SurveyJS form exported as JSON) and returns
   a RAYDAR study: its questions in eSource order and wording, its Study Notes, its rules for Quick check, and
   any cohort dates from RAYDAR cohort dates.json. Nothing in the eSource is rewritten: answer text, notes and
   conditions are used as TST wrote them. Problems that would stop a question showing are listed in `issues`. */
import { compile, all } from './expr.js';

const EMOJI_X = /\u{1F6D1}|\u{1F6AB}|❌|⛔/u; // 🛑 🚫 ❌ ⛔ exclude
const EMOJI_D = /⚠/u; // ⚠ check with doctors
const EMOJI_C = /✅/u; // ✅ continue
export const outcomeOf = (text) => (EMOJI_X.test(text) ? 'x' : EMOJI_D.test(text) ? 'd' : EMOJI_C.test(text) ? 'c' : null);

const QUESTION_TYPES = new Set(['radiogroup', 'checkbox', 'dropdown', 'tagbox', 'boolean', 'text', 'comment', 'paneldynamic', 'dobandage', 'bmi', 'rating']);
const NOTE_TYPES = new Set(['html', 'image', 'expression']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/** Plain text from a title or description that may hold a little HTML. */
export function plain(s) {
  return String(s == null ? '' : s)
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (m, e) => (e[0] === '#' && e !== '#39' ? String.fromCharCode(parseInt(e.slice(e[1] === 'x' ? 2 : 1), e[1] === 'x' ? 16 : 10)) : ENT[e] ?? m))
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const words = (t, n) => { const w = plain(t).replace(/\s+/g, ' ').split(' ').filter(Boolean); return w.slice(0, n).join(' ') + (w.length > n ? '…' : ''); };
const autoName = (n) => /^(question|panel)\d+[a-z]?$/i.test(n) || /^item\s*\d*$/i.test(n);
const SITE_SHORT = { 'Emeritus Melbourne': 'MEL', 'Emeritus Sydney': 'SYD', Veritus: 'VER' };

function choices(el) {
  if (el.type === 'boolean') {
    const t = plain(el.labelTrue || 'Yes'), f = plain(el.labelFalse || 'No');
    return [{ v: true, t }, { v: false, t: f }];
  }
  return (el.choices || []).map((c) => (c !== null && typeof c === 'object'
    ? { v: c.value, t: plain(c.text != null ? c.text : c.value) }
    : { v: c, t: plain(c) }));
}

/** The study's identity from its file name: "Veritus - EQ - pre-screening.json" → site Veritus, code EQ. */
export function nameParts(file, json) {
  const base = String(file).replace(/^.*[\\/]/, '').replace(/\.json$/i, '');
  const parts = base.split(' - ').map((x) => x.trim());
  if (parts.length >= 3) return { site: parts[0], code: parts.slice(1, -1).join(' - ') };
  if (parts.length === 2) return { site: parts[0], code: parts[1] };
  return { site: '', code: plain(json.title || base).replace(/\s*pre-?screening\s*$/i, '') };
}

/**
 * @param file   eSource file name (also the key into the cohort dates file)
 * @param json   the parsed eSource
 * @param dates  that study's entry from RAYDAR cohort dates.json, if any
 */
export function convert(file, json, dates) {
  const { site, code } = nameParts(file, json);
  const issues = [];
  const items = [];

  /* 1. Flatten pages and panels in order. A panel's condition applies to everything inside it. */
  (json.pages || []).forEach((p, pi) => {
    const page = plain(p.title || p.name || 'Page ' + (pi + 1)) || 'Page ' + (pi + 1);
    const pv = compile(p.visibleIf);
    const walk = (els, conds) => {
      for (const el of els || []) {
        if (!el || !el.type) continue;
        const own = compile(el.visibleIf);
        const cs = own ? [...conds, own] : conds;
        if (el.type === 'panel') {
          const title = plain(el.title), desc = plain(el.description);
          if ((title && title !== el.name) || desc) items.push({ el: { type: 'html', name: el.name + ' (panel)', html: (title && title !== el.name ? '<p><strong>' + esc(title) + '</strong></p>' : '') + (desc ? '<p>' + esc(desc).replace(/\n/g, '<br>') + '</p>' : '') }, vis: all(cs), page, pi });
          walk(el.elements, cs);
          continue;
        }
        items.push({ el, vis: all(cs), page, pi });
      }
    };
    walk(p.elements, pv ? [pv] : []);
  });

  /* 2. Names, for conditions and the file check */
  const byName = {}, seen = {};
  items.forEach(({ el }) => {
    if (seen[el.name]) issues.push({ q: el.name, msg: 'Two elements are both called "' + el.name + '". Conditions can only point at one of them.' });
    seen[el.name] = true;
    byName[el.name] = el;
  });
  const ageNames = items.filter((x) => x.el.type === 'dobandage').map((x) => x.el.name);

  /* 3. Questions, notes and Study Notes */
  const Q = [], notes = [], pendingBefore = {}, lastQ = {};
  let hidden = 0;
  const isNotesPage = (page) => /study\s*notes?/i.test(page);
  const htmlOf = (el) => (el.type === 'image'
    ? '<p><em>Picture in the eSource. Open the eSource to see it.</em></p>'
    : el.type === 'expression' ? '<p>' + esc(plain(el.title || el.name)) + '</p>' : String(el.html || ''));

  for (const it of items) {
    const { el, vis, page } = it;
    if (vis && vis.never) { hidden++; continue; }
    if (NOTE_TYPES.has(el.type)) {
      const block = { name: el.name, html: htmlOf(el), vis };
      if (isNotesPage(page)) {
        let n = notes.find((x) => x.page === page);
        if (!n) notes.push((n = { page, blocks: [] }));
        n.blocks.push(block);
      } else if (vis) {
        // A note that appears only after certain answers becomes a step of its own, so it can't be missed
        Q.push({ id: el.name, kind: 'note', sec: page, t: '', html: [block], a: [['Noted', 'i', 'noted']], s: 'Note', vis, r: '' });
      } else {
        (pendingBefore[page] = pendingBefore[page] || []).push(block);
      }
      continue;
    }
    if (!QUESTION_TYPES.has(el.type)) continue;

    const q = { id: el.name, sec: page, t: plain(el.title || el.name), r: plain(el.description), vis, src: el.type };
    q.s = autoName(el.name) ? words(el.title || el.name, 6) : plain(el.name);
    if (el.type === 'dobandage') {
      q.kind = 'choice'; q.auto = 'age';
      q.a = [['Age confirmed', 'c', 'ok'], ['Outside the age range', 'x', 'out']];
    } else if (el.type === 'bmi') {
      q.kind = 'choice'; q.auto = 'bmi';
      const lo = +el.bmiRangeMin, hi = +el.bmiRangeMax;
      q.range = [isFinite(lo) && el.bmiRangeMin != null ? lo : 0, isFinite(hi) && el.bmiRangeMax != null ? hi : 100];
      q.a = [['BMI confirmed', 'c', 'ok'], ['Outside the BMI range', 'x', 'out']];
    } else if (el.type === 'paneldynamic') {
      const fields = (el.templateElements || []).map((x) => plain(x.title || x.name)).join(' ').toLowerCase();
      q.kind = 'log'; q.carry = /condition|event|history|diagnos/.test(fields) ? 'hx' : 'med';
      q.a = [['None', 'c', 'none'], ['Logged', 'c', 'logged'], ['Logged, raise with doctors', 'd', 'dr']];
    } else if (el.type === 'text' || el.type === 'comment') {
      q.kind = 'text'; q.a = []; q.long = el.type === 'comment';
      q.inputType = el.inputType || '';
    } else {
      q.kind = el.type === 'checkbox' || el.type === 'tagbox' ? 'multi' : 'choice';
      q.a = choices(el).map((c) => [c.t, outcomeOf(c.t), c.v]);
      if (el.type === 'radiogroup' && /^sex$|^gender$/i.test(el.name) && q.a.some((b) => /^male\b/i.test(b[0]))) q.auto = 'sex';
    }
    if (/holiday/i.test(q.t) && q.kind === 'choice') q.hol = true;
    if (pendingBefore[page]) { q.before = pendingBefore[page]; delete pendingBefore[page]; }
    Q.push(q);
    lastQ[page] = q;
  }
  // Notes at the end of a page go under its last question
  Object.entries(pendingBefore).forEach(([page, blocks]) => {
    if (lastQ[page]) lastQ[page].after = (lastQ[page].after || []).concat(blocks);
    else Q.push({ id: '_note_' + page, kind: 'note', sec: page, t: '', html: blocks, a: [['Noted', 'i', 'noted']], s: 'Note', r: '' });
  });

  /* 4. Follow-ups: which answers open which questions, and the link shown on screen */
  const qById = Object.fromEntries(Q.map((q) => [q.id, q]));
  const triggers = {}; // question id → set of values that some condition looks for
  items.forEach(({ vis }) => (vis ? vis.pairs : []).forEach((pr) => {
    const base = pr.name.split('.')[0].trim();
    if (['=', '==', 'contains', 'anyof', 'allof'].includes(pr.op)) pr.v.forEach((v) => (triggers[base] = triggers[base] || new Set()).add(String(v)));
  }));
  Q.forEach((q) => {
    q.a.forEach((b) => { if (!b[1]) b[1] = triggers[q.id] && triggers[q.id].has(String(b[2])) ? 'n' : 'i'; });
    if (q.vis) {
      const parent = q.vis.deps.find((d) => qById[d] && d !== q.id && !qById[d].auto);
      if (parent) q.when = { id: parent };
      q.deps = q.vis.deps;
    }
  });

  /* 5. Quick check rules: age from the eSource's own age-exclusion conditions, BMI from its BMI questions */
  let age = null;
  const lows = [], highs = [];
  items.forEach(({ vis }) => (vis ? vis.pairs : []).forEach((pr) => {
    if (!ageNames.includes(pr.name.split('.')[0].trim())) return;
    const n = +pr.v[0];
    if (!isFinite(n)) return;
    if (pr.op === '<') lows.push(n); else if (pr.op === '<=') lows.push(n + 1);
    else if (pr.op === '>') highs.push(n); else if (pr.op === '>=') highs.push(n - 1);
  }));
  if (lows.length || highs.length) age = [lows.length ? Math.max(...lows) : 18, highs.length ? Math.min(...highs) : 120];
  else {
    const dobQ = Q.find((q) => q.auto === 'age');
    const m = dobQ && (/(\d{2})\s*(?:-|–|to)\s*(\d{2})/.exec(dobQ.r) || /(\d{2})\s*\+/.exec(dobQ.r) || /(\d{2}) years? (?:or|and) (?:older|over)/i.exec(dobQ.r));
    if (m) age = [+m[1], m[2] ? +m[2] : 120];
  }
  Q.filter((q) => q.auto === 'age').forEach((q) => (q.range = age));
  const bmis = Q.filter((q) => q.auto === 'bmi').map((q) => q.range);
  const bmi = bmis.length ? [Math.min(...bmis.map((r) => r[0])), Math.max(...bmis.map((r) => r[1]))] : null;

  /* 6. File check: things that would stop a question showing, or leave RAYDAR unable to read an answer */
  items.forEach(({ el, vis }) => {
    if (!vis || vis.never) return;
    if (vis.error) issues.push({ q: el.name, msg: 'Its condition "' + vis.src + '" can\'t be read (' + vis.error + '), so it never shows.' });
    vis.deps.forEach((d) => { if (!byName[d]) issues.push({ q: el.name, msg: 'It depends on "' + d + '", which isn\'t in this eSource, so it never shows.' }); });
    vis.pairs.forEach((pr) => {
      const base = pr.name.split('.')[0].trim(), dep = byName[base];
      if (!dep || !(dep.choices || dep.type === 'boolean')) return;
      const vals = choices(dep).map((c) => String(c.v));
      pr.v.filter((v) => typeof v === 'string' && !vals.includes(v)).forEach((v) => issues.push({ q: el.name, msg: 'It looks for the answer "' + v + '" on "' + base + '", which has no such answer' + (vals.includes(v.trim()) ? ' (a stray space?)' : '') + '.' }));
    });
  });
  const noMark = Q.filter((q) => (q.kind === 'choice' || q.kind === 'multi') && !q.auto && q.a.some((b) => b[1] === 'i'));
  if (noMark.length) issues.push({ q: '', msg: noMark.length + ' question' + (noMark.length > 1 ? 's have' : ' has') + ' answers with no outcome marker (✅ ⚠️ 🛑), so RAYDAR shows them in grey: ' + noMark.slice(0, 8).map((q) => q.s).join('; ') + (noMark.length > 8 ? '…' : '') });

  return {
    c: code, code, site, siteShort: SITE_SHORT[site] || site.slice(0, 3).toUpperCase(), file: String(file).replace(/^.*[\\/]/, ''),
    d: plain(json.title || code).replace(/\s*pre-?screening\s*$/i, ''), version: plain(json.version || ''),
    Q, byName: qById, notes, age, bmi, hidden, issues,
    types: dates && dates.types ? dates.types : null,
    cohorts: dates && dates.cohorts && dates.cohorts.length ? dates.cohorts.map((c) => ({ ...c, closed: !!c.closed, v: (c.v || []).map((v) => ({ ...v, w: v.w || 0 })) })) : null,
    datesSrc: dates ? dates.cohorts.map((c) => c.src).filter(Boolean) : [],
  };
}
