/* eSource → RAYDAR (2.5). Reads one TST pre-screening eSource (a SurveyJS form exported as JSON) and returns
   a RAYDAR study: its questions in eSource order and wording, its Study Notes, its rules for Quick check, and
   any cohort dates from RAYDAR cohort dates.json. Nothing in the eSource is rewritten: answer text, notes and
   conditions are used as TST wrote them. Problems that would stop a question showing are listed in `issues`. */
import { compile, all } from './expr.js';
import { readCovers } from '../medicines/items.js';

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
  const Q = [], notes = [], pendingBefore = {}, lastQ = {}, proSources = [];
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
      } else if (lastQ[page]) {
        // TST writes a note straight after the question it explains (2.6 fix: 2.5 put it on the next question)
        lastQ[page].after = (lastQ[page].after || []).concat(block);
      } else {
        (pendingBefore[page] = pendingBefore[page] || []).push(block);
      }
      if (el.type === 'html' && !isNotesPage(page)) proSources.push({ el, prevQ: lastQ[page] || null, page });
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

  const pro = extractPro(proSources);
  extractQuestions(Q, pro); // 2.8: medication and condition questions with exclude or doctor answers

  return {
    pro: pro.lists, proNotes: pro.notes,
    c: code, code, site, siteShort: SITE_SHORT[site] || site.slice(0, 3).toUpperCase(), file: String(file).replace(/^.*[\\/]/, ''),
    d: plain(json.title || code).replace(/\s*pre-?screening\s*$/i, ''), version: plain(json.version || ''),
    Q, byName: qById, notes, age, bmi, hidden, issues,
    types: dates && dates.types ? dates.types : null,
    cohorts: dates && dates.cohorts && dates.cohorts.length ? dates.cohorts.map((c) => ({ ...c, closed: !!c.closed, v: (c.v || []).map((v) => ({ ...v, w: v.w || 0 })) })) : null,
    datesSrc: dates ? dates.cohorts.map((c) => c.src).filter(Boolean) : [],
  };
}

/* ---- Prohibited lists (2.6) ----
   TST keeps each study's exclusion lists as bulleted notes ("Exclusionary Medication List", "PLEASE EXCLUDE THE
   FOLLOWING"). RAYDAR keeps every bullet as written, groups it under its parent bullet, and sorts the note into
   medications or conditions from its title or the question it follows. Logged medications are matched on drug
   names found in a bullet (capitalised names, common drug endings, "ending in ..."); conditions are listed for
   reference only, since matching them on words would misfire (a "type 2 diabetes" study excludes "non-type 2 diabetes"). */
const PRO_NOTE = /dr enquiry\s*\/\s*exclude|exclude\s*\/\s*dr enquiry|exclude the following|exclusionary|prohibited|please exclude|not permitted|are exclusionary|following are excluded/i;
const MED_WORDS = /medication|\bmeds?\b|drug|medicine|tablet|inhaler|supplement/i;
const HX_WORDS = /condition|medical history|history|disease|diagnos|illness|disorder/i;
const STOP = new Set('please exclude following within months weeks years oral certain chronic other including unless history illicit stability medication medications drugs agents inhibitors agonists antagonists blockers receptor therapy therapies treatment treatments systemic topical injectable injection injections prescription prescribed current currently recent recently previous prior unsure raise medical query severe condition conditions disease diseases except exception exceptions allowed permitted stable daily weekly doses doctor doctors calcium channel serotonin dopamine antibiotics anticholinergics antispasmodics cholinergic sulfonylureas weight receipt anticipation yellow nasal anything liquid laser started critical commencement maintenance infected bleach plans interventions muscular cholesterol changes sodium synthetic spinal atrophy lateral duchenne dystrophy amyotrophic sclerosis platelet-rich narrowband anti-cancer biologics monoamine glucose-lowering specific timeframe required determined known participants participant study screening should would their there these those which where while during before after above below between under every first second third types type acute active approved being cannot could given greater higher lower other over regular regularly short long term significant unknown using visit years-old hours minutes stable'.split(' '));
const DRUG_END = /(pril|sartan|olol|statin|mab|nib|tide|gliptin|gliflozin|azole|mycin|cillin|cycline|floxacin|dipine|pine|lone|sone|olone|azepam|zolam|pam|oxetine|aline|amine|triptan|parin|xaban|gatran|vir|dronate|setron|prazole|tidine|lukast|terol|tropium|onium|caine|codone|morphone|profen|fenac|coxib|semide|thiazide|zide|formin|glinide|glitazone|lutide|glutide)$/i;

function proKeywords(text) {
  const k = new Set();
  const end = /ending in\s*["“'‘]?([a-z]{4,})/i.exec(text);
  if (end) k.add(end[1].toLowerCase());
  String(text).split(/[^A-Za-z0-9-]+/).forEach((w) => {
    const lw = w.toLowerCase().replace(/^-+|-+$/g, '');
    if (lw.length < 5 || STOP.has(lw) || /^\d/.test(lw)) return;
    if (/^[A-Z][a-z]/.test(w) || DRUG_END.test(lw)) k.add(lw);
  });
  return [...k];
}

/** Bullets with their parent bullet, from editor HTML, without a DOM. */
function bullets(html) {
  const out = [], stack = [];
  const re = /<(\/?)(li|ul|ol|p|div|h[1-6]|br)\b[^>]*>|<[^>]+>|([^<]+)/gi;
  let m, top = '', last = '';
  while ((m = re.exec(String(html)))) {
    if (m[3] != null) { if (stack.length) stack[stack.length - 1].text += m[3]; else top += m[3]; continue; }
    const tag = (m[2] || '').toLowerCase();
    // 2.8: the line of text just before a list ("Exceptions", "Non-live vaccines are permitted") goes with its bullets
    if (/^(p|div|h[1-6]|br)$/.test(tag) && !m[1] && !stack.length) { if (plain(top).replace(/\u00a0/g, '').trim()) last = plain(top); top = ''; }
    if (tag === 'li' && !m[1]) { const parent = stack[stack.length - 1] || null; const node = { text: '', parent, kids: 0, ctx: parent ? parent.ctx : (plain(top).replace(/\u00a0/g, '').trim() ? plain(top) : last) }; if (parent) parent.kids++; stack.push(node); out.push(node); }
    else if (tag === 'li' && m[1]) stack.pop();
  }
  return out.map((n) => ({ text: plain(n.text), parent: n.parent ? plain(n.parent.text) : '', leaf: !n.kids, ctx: n.ctx || '' })).filter((n) => n.text);
}
/* Bullets that say what's allowed, accepted or doesn't count, not what's prohibited */
const ALLOWED = /^\W*(exceptions?\b|permitted\b|allowed\b|accepted\b|non-live|examples of non-live|what does not count)|\b(are|is) (permitted|allowed|accepted|fine|ok(ay)?)\b|wouldn't be exclusionary|(are|is) not exclusionary|does(n't| not) count|can be used|(is|are) required|must be (using|taking|on)\b/i;

/* 2.8: prohibited items read from the questions themselves. A question that asks whether the participant has taken
   or received a medicine the dictionary knows ("In the last 4 weeks have you taken spironolactone?"), and where a
   "yes" answer excludes or needs the doctors, becomes an item in its own words; so does a condition question ("Do you
   have glaucoma?"). Each choice of a tick-all question that names a medicine does too. Nothing is reworded: the item
   is the question's text, its outcome the answers' markers. Hidden questions never get here. */
const EXCLUDES = /\bexclud(es|ed|e)\b|\bexclusion|cannot have|must not have|not be taking|not permitted|delay screening/i;
const NOT_MED_Q = /contracep|condom|pregnan|breastfeed|refrain|abstain|is this (ok|okay|alright)|are you (ok|okay|happy)|allerg|intoleran|hypersensitiv|sensitivit|participat|clinical (trial|study)|investigational|feasib|consent|donat|blood test|drug test|urine|breath test|contact lens|swallow|gelatin|travel|holiday|visits?\b/i;
const MED_Q = /\b(taken|taking|take|used|using|use|received|receiving|been on|treated with|prescribed|had any)\b/i;
const HX_Q = /\b(do you have|have you (ever )?(been diagnosed|had|suffered)|diagnosed with|history of|do you suffer)\b/i;
const medCovers = (t) => { const c = readCovers(t); return c.i.length || c.g.length; };
/* a bullet that names a medicine, or a vaccine under a vaccines heading ("herpes zoster (shingles) vaccine") */
const listedDrug = (i) => medCovers(i.text) || (/vaccin/i.test(i.text) && readCovers(i.ctx + ' ' + i.parent).g.some((g) => g.startsWith('x-vaccine')));
const yesOutcome = (a) => {
  const yes = a.filter((b) => !/^\s*no\b|^\s*none\b|^\s*n\/a\b/i.test(b[0]) && b[1] !== 'i' && b[1] !== 'n');
  if (!yes.some((b) => b[1] === 'x' || b[1] === 'd')) return null;
  // a plain "Yes - Exclude" decides it; qualified answers ("Yes, metformin for non-diabetic reasons") are exceptions
  const plainYes = yes.find((b) => /^\s*yes\s*[-–:]/i.test(b[0]));
  if (plainYes && (plainYes[1] === 'x' || plainYes[1] === 'd')) return plainYes[1];
  return yes.every((b) => b[1] === 'x') ? 'x' : 'd';
};
function extractQuestions(Q, pro) {
  const have = { med: new Set(pro.lists.med.map((p) => p.n)), hx: new Set(pro.lists.hx.map((p) => p.n)) };
  const add = (kind, item) => { if (have[kind].has(item.n)) return; have[kind].add(item.n); pro.lists[kind].push(item); };
  Q.forEach((q) => {
    if (!(q.kind === 'choice' || q.kind === 'multi') || q.auto || !q.t || NOT_MED_Q.test(q.t)) return;
    const where = 'Question: ' + words(q.t, 10);
    if (q.kind === 'multi') {
      q.a.filter((b) => (b[1] === 'x' || b[1] === 'd') && medCovers(b[0])).forEach((b) => add('med', { n: b[0], w: plain(q.t), o: b[1], k: proKeywords(b[0]), no: [], src: q.id, from: 'q' }));
      return;
    }
    const o = yesOutcome(q.a);
    if (!o) return;
    if (MED_Q.test(q.t) && medCovers(q.t)) add('med', { n: q.t, w: where, o, k: proKeywords(q.t), no: [], src: q.id, from: 'q' });
    else if (HX_Q.test(q.t) && !MED_Q.test(q.t.replace(HX_Q, ''))) add('hx', { n: q.t, w: where, o, k: [], no: [], src: q.id, from: 'q' });
  });
}

export const _proDebug = () => ({ bullets, ALLOWED });
function extractPro(sources) {
  const lists = { med: [], hx: [] }, notes = { med: [], hx: [] };
  sources.forEach(({ el, prevQ }) => {
    const html = String(el.html || ''), text = plain(html);
    if (/holiday|travel|location|schedule|availability/i.test(el.name)) return;
    const items = bullets(html);
    if (items.length < 2) return;
    // 2.8: a bulleted note without a "prohibited" title still counts when two or more bullets name medicines the
    // dictionary knows (SB3567's "If currently taking: oral antibiotics… spironolactone… isotretinoin")
    const titled = PRO_NOTE.test(el.name + ' ' + text.slice(0, 200));
    // an untitled note counts only when it says the study excludes something, or it explains a question whose
    // "yes" answer excludes or needs the doctors; a list of what's required or allowed never counts
    let qo = null;
    if (!titled) {
      const drugs = items.filter((i) => i.leaf && !ALLOWED.test(i.ctx + ' ' + i.parent) && listedDrug(i)).length;
      const says = EXCLUDES.test(text);
      qo = prevQ && !NOT_MED_Q.test(prevQ.t) && MED_Q.test(prevQ.t) ? yesOutcome(prevQ.a || []) : null;
      // a drug list written straight after the medication log is what recruiters check the log against
      if (!qo && prevQ && prevQ.kind === 'log' && prevQ.carry === 'med') qo = 'x';
      const leaves = items.filter((i) => i.leaf && !ALLOWED.test(i.ctx + ' ' + i.parent)).length;
      if (drugs < 2 || drugs * 2 < leaves || (!says && !qo) || NOT_MED_Q.test(text.slice(0, 200))) return;
    }
    const forced = titled ? '' : 'med';
    const head = el.name + ' ' + text.slice(0, 160);
    let kind = forced || (MED_WORDS.test(head) && !HX_WORDS.test(head)) ? forced || 'med' : HX_WORDS.test(head) && !MED_WORDS.test(head) ? 'hx' : '';
    if (!kind && prevQ) kind = prevQ.carry === 'med' || MED_WORDS.test(prevQ.t) ? 'med' : prevQ.carry === 'hx' || HX_WORDS.test(prevQ.t) ? 'hx' : '';
    if (!kind) kind = items.filter((i) => proKeywords(i.text).some((w) => DRUG_END.test(w))).length >= 2 ? 'med' : 'hx';
    const where = autoName(el.name) ? (prevQ ? 'Under: ' + words(prevQ.t, 8) : 'eSource note') : plain(el.name);
    notes[kind].push({ name: el.name, html, vis: null, title: where });
    items.filter((i) => i.leaf && !ALLOWED.test(i.ctx + ' ' + i.parent) && (titled || listedDrug(i))).forEach((i) => {
      const t = (i.parent ? i.parent + ': ' : '') + i.text;
      const o = /raise|query|⚠|check with|doctor|dr enquiry|\bdelay/i.test(t) ? 'd' : qo || 'x';
      lists[kind].push({ n: i.text, w: i.parent || i.ctx || where, o, k: kind === 'med' ? proKeywords(i.text) : [], no: [], src: el.name, q: prevQ ? prevQ.t : '' });
    });
  });
  return { lists, notes };
}
