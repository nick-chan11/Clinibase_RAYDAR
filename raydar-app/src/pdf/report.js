/* RAYDAR 2.7: the pre-screen PDF and the callback data inside it.
   The layout copies RAYDAR Combined's clinic PDF: page 1 is the summary (study, PID, verdict, callback reason, what needs
   attention, call notes), then every answered question in full, the Quick Check details and the study notes.
   Every PDF carries the call's answers as an embedded CSV, so Import callback can reopen it. Like Combined, the data
   never holds the participant's name, phone, email or date of birth: the date of birth is asked again on reopening.
   jsPDF is bundled, so saving works offline. */
import { jsPDF } from 'jspdf';
import { S, qset, age, bmi, selC, matchP, eParts, noteShows, inCarry, fmtR, fresh, replaceS, askConds, isHiddenQ } from '../engine/store.js';
import { CONDS } from '../engine/data.js';
import { ST, SOURCE } from '../esource/studies.js';

/* ---------- outcomes, callback reasons and file names ---------- */
export const CALLBACK_REASONS = [
  ['Not a good time', 'Not a good time'],
  ['Unsure on dates', 'Unsure on dates'],
  ['Holidays interfere', 'Holidays interfere'],
  ['No available slots', 'No available slots'],
  ['Wants time to think', 'Wants time to think it over'],
  ['Checking with GP', 'Checking with their GP / doctor'],
  ['Not eligible now', 'Not eligible now (may be eligible later)'],
  ['', 'Other / no specific reason'],
];
export const BUILD = 'RAYDAR 2.11';
const FORMAT = 'RAYDAR-CALLBACK-CSV', FORMAT_VERSION = '1', PDF_DATA_NAME = 'raydar_prescreen_data.csv', MARK = 'record,study,key,value';
const CSV_MAX_BYTES = 4e6, CSV_MAX_ROWS = 50000, CSV_MAX_CELL = 400000;

export { protoCode } from '../esource/codes.js';
import { protoCode, qhash } from '../esource/codes.js';
// 2.10: the Clinibase logo on page 1 (from Clinibase Branding), built into the file
import LOGO from '../../../Clinibase Branding/Logos Red Bilby/CLINIBASE LOGO/Logos/CLINIBASE-LOGO-BLACK-BLUE300x58.png?inline';

export function fnPart(s, max) {
  let t = String(s || '').replace(/&[a-z]+;/gi, ' ').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  if (max && t.length > max) {
    t = t.slice(0, max);
    const k = t.lastIndexOf('_');
    if (k > max * 0.5) t = t.slice(0, k);
    t = t.replace(/_+$/, '');
  }
  return t;
}
const fnStudyCode = (c) => String(c || '').replace(/[^A-Za-z0-9._-]+/g, '_');

/* ---------- text the built-in PDF font can draw ---------- */
export function glyphSafe(s) {
  let t = String(s == null ? '' : s);
  try { t = t.normalize('NFC'); } catch (e) { /* keep as is */ }
  return t
    .replace(/→|⇒/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/α/g, 'alpha')
    .replace(/≈/g, '~').replace(/≠/g, '!=').replace(/[−‐‑‒―]/g, '-')
    .replace(/℃/g, '°C').replace(/℉/g, '°F').replace(/μ/g, 'u').replace(/µ/g, 'u')
    .replace(/[✓✔]/g, '(yes)').replace(/[✕✖✗✘]/g, '(no)')
    .replace(/[     ]/g, ' ').replace(/[​-‍⁠﻿]/g, '')
    .replace(/[‣▪●◦⁃]/g, '•')
    .replace(/[^\x09\x0A\x20-\x7E¡-ÿ‘’“”•–—…€™]/g, '');
}
const cpSafe = (t) => glyphSafe(String(t == null ? '' : t).replace(/[–—]/g, '-'));
/** An answer label without its emoji or doubled spaces: "No - continue ✅" → "No - continue" */
export const clean = (a) => cpSafe(a).replace(/[ \t]+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
const cleanAns = (a) => clean(a).replace(/\s*\n\s*/g, ' ') || '-';

/** Plain text from eSource HTML, one line per paragraph or list item. */
export function htmlText(html) {
  return cpSafe(String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (m, x) => String.fromCodePoint(+x)))
    .split('\n').map((x) => x.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/* ---------- what the PDF says: worked out from the call ---------- */
const nm = (k) => (CONDS.find((c) => c[0] === k) || [k, k])[1];
const yn = (v) => (v === 'y' ? 'Yes' : v === 'n' ? 'No' : '-');

/** ⚠️ answers that say "delay" are Delay or exclude; the other ⚠️ answers are a doctor enquiry */
function tagOf(q) {
  const o = S.out[q.id];
  if (o === 'x') return 'x';
  if (o === 'd') return /delay/i.test(S.ans[q.id] || '') ? 'd' : 'f';
  return null;
}
function autoMsg(q) {
  if (q.auto === 'bmi') { const r = q.range || (S.study && S.study.bmi); return r ? 'Outside BMI ' + r[0] + '-' + r[1] + ' kg/m2 range' : 'Outside the BMI range'; }
  if (q.auto === 'age') { const r = q.range || (S.study && S.study.age); return r ? 'Outside age ' + r[0] + '-' + (r[1] >= 120 ? '+' : r[1]) + ' range' : 'Outside the age range'; }
  if (q.hol) return 'Away dates clash with the study visits';
  return '';
}
function shortQ(q) { return clean(q.s || q.t).replace(/…$/, '...'); }
/** The headline for a flagged answer: the criteria the recruiter ticked, the age or BMI range, else question and answer */
function msgFor(q) {
  const w = S.why[q.id];
  if (w && w.length) return w.join('; ');
  return autoMsg(q) || shortQ(q) + ': ' + cleanAns(S.ans[q.id]);
}
/** The exclusion reason in the file name */
export function failReason() {
  const q = qset().find((z) => S.out[z.id] === 'x');
  if (!q) return 'Not specified';
  const w = S.why[q.id];
  return (w && w[0]) || autoMsg(q) || shortQ(q).replace(/\.\.\.$/, '');
}
function logLine(e) {
  const p = eParts(e);
  return e.n + (p.length ? ' - ' + p.join(', ') : '') + (e.f ? ' (flagged for the doctors)' : '');
}
function answerText(q) {
  let a;
  if (q.auto === 'age') { const n = age(); a = n != null ? n + ' yrs (DOB ' + S.dob + ')' : 'Date of birth not entered'; }
  else if (q.auto === 'bmi') { const b = bmi(); a = b != null ? 'Height ' + S.ht + ' cm, Weight ' + S.wt + ' kg (BMI ' + b + ' kg/m2)' : 'Height and weight not entered'; }
  else if (q.kind === 'log') {
    const L = S.log.filter((e) => inCarry(e, q.carry));
    a = L.length ? L.map(logLine).join('; ') : 'None';
    if (L.length && S.out[q.id] === 'd') a += ' | ' + clean(S.ans[q.id]);
  } else a = S.ans[q.id];
  const n = String(S.note[q.id] || '').trim();
  return cleanAns(a) + (n ? ' | Recruiter note: ' + cleanAns(n) : '');
}
function refText(q) {
  return (q.before || []).concat(q.after || []).filter(noteShows).map((b) => htmlText(b.html)).filter(Boolean).join('\n');
}

function verdict(k, dr, L) {
  const asked = L.filter((q) => q.kind !== 'note'), un = asked.filter((q) => !S.out[q.id]).length;
  const tags = asked.map(tagOf);
  const x = ['EXCLUDE - DO NOT BOOK', 'bad'];
  const hold = ['DOCTOR ENQUIRY - HOLD BOOKING UNTIL THE DOCTOR REPLIES', 'warn'];
  const ok = ['CONTINUE - CLEAR TO BOOK', 'ok'];
  if (k === 'x') return x;
  if (k === 'd') return dr === 'book' ? ['DOCTOR ENQUIRY - BOOK NOW, CANCEL IF THE DOCTOR SAYS NO', 'warn'] : hold;
  if (k === 'c') return S.study && un ? ['INCOMPLETE - ' + un + (un === 1 ? ' QUESTION' : ' QUESTIONS') + ' NOT ANSWERED', 'idle'] : ok;
  if (!S.study || un) return ['INCOMPLETE - SCREENING STOPPED MID-CALL', 'idle'];
  if (tags.includes('x')) return x;
  if (tags.includes('d') || tags.includes('f') || S.log.some((e) => e.f)) return hold;
  return ok;
}

/** Everything the PDF and its file name need, from the outcome the recruiter picked on Finish. */
export function summary(k, opt) {
  opt = opt || {};
  const s = S.study, dr = opt.dr || 'hold', L = s ? qset() : [];
  const [vLabel, vKind] = verdict(k, dr, L);
  const isCallback = k === 'cb' || (k === 'd' && dr !== 'book');
  const cbr = CALLBACK_REASONS.find((r) => r[0] === (opt.cbr || '')) || CALLBACK_REASONS[CALLBACK_REASONS.length - 1];
  const callbackReason = k === 'd' ? 'Doctor enquiry pending' : k === 'cb' ? cbr[0] : '';
  const un = L.filter((q) => q.kind !== 'note' && !S.out[q.id] && !isHiddenQ(q.id)).length;
  let fileReason;
  if (k === 'x') fileReason = 'Fail_' + fnPart(failReason(), 45);
  else if (k === 'd') fileReason = dr === 'book' ? 'Booked_DrEnquiry' : 'Callback_Doctor_enquiry_pending';
  else if (k === 'cb') fileReason = 'Callback' + (cbr[0] ? '_' + cbr[0] : '');
  else fileReason = s && un ? 'Incomplete' : 'Booked';
  const code = protoCode(s);
  const pid = String(S.pid || '').trim();
  // 2.10: a PDF made in test mode says so in its name, and has no PID unless one was typed
  const fileName = (S.tm ? 'TEST-' : '') + [fnPart(pid, 30) || (S.tm ? '' : 'NoPID'), fnStudyCode(code), fnPart(fileReason, 60)].filter(Boolean).join('-') + '.pdf';

  const rows = L.filter((q) => q.kind !== 'note' && S.out[q.id]).map((q) => {
    const tag = tagOf(q);
    return { id: q.id, sec: q.sec, q: q.t, hint: q.r, ref: refText(q), a: answerText(q), tag, msgs: tag ? [{ k: tag, m: msgFor(q) }] : [] };
  });
  // logged medications and conditions that match the study's prohibited lists, or that the recruiter flagged
  const extra = [];
  if (s) S.log.forEach((e) => {
    const p = matchP(e, s.c);
    if (p && p.o === 'x') extra.push({ k: 'x', m: e.n + ': on the prohibited list (' + p.n + ')' });
    else if (p && p.o === 'd') extra.push({ k: 'f', m: e.n + ': doctor check (' + p.n + ')' });
    else if (e.f) extra.push({ k: 'f', m: e.n + ': flagged for the doctors' });
  });
  return {
    test: !!S.tm, k, dr, s, code, pid, fileName, verdictLabel: vLabel, verdictKind: vKind, isCallback, callbackReason,
    kind: isCallback || vKind === 'idle' ? 'callback' : 'pdf',
    pop: popLine(s), rows, extra, quickRows: quickRows(), notesReviewed: !!(s && S.read[s.c]),
    cohorts: s ? selC().map((c) => c.n) : [], notes: String(S.finalNotes || '').trim(), rev: S.rev || 1, prevFile: S.prevFile || '',
  };
}
function popLine(s) {
  if (!s) return 'Quick Check only, no study pre-screen';
  let rest = String(s.d || '').replace(/^\s*[A-Za-z0-9][A-Za-z0-9.-]*\d[A-Za-z0-9.-]*/, '').replace(/\bpre[\s-]?screening\b.*$/i, '')
    .replace(/^[\s\-–(]+|[\s)\-–]+$/g, '').trim();
  if (/^(emeritus\s+)?(melbourne|sydney)$/i.test(rest) || rest === s.code) rest = '';
  const parts = [s.siteLabel || s.site];
  if (rest) parts.push(rest);
  if (s.age) parts.push('age ' + s.age[0] + (s.age[1] >= 120 ? '+' : ' to ' + s.age[1]));
  if (s.bmi && !(s.bmi[0] <= 0 && s.bmi[1] >= 100)) parts.push('BMI ' + (s.bmi[1] >= 100 ? s.bmi[0] + '+' : s.bmi[0] <= 0 ? 'up to ' + s.bmi[1] : s.bmi[0] + ' to ' + s.bmi[1]));
  return parts.join(' - ');
}
function quickRows() {
  const out = [], a = age(), b = bmi();
  out.push({ q: 'Date of birth / age', a: S.dob ? S.dob + (a != null ? ' (' + a + ' yrs)' : '') : '-' });
  out.push({ q: 'Biological sex', a: S.sex === 'f' ? 'Female' : S.sex === 'm' ? 'Male' : '-' });
  out.push({ q: 'Height / weight / BMI', a: S.ht || S.wt ? (S.ht || '?') + ' cm / ' + (S.wt || '?') + ' kg' + (b != null ? ' / ' + b + ' kg/m2' : '') : '-' });
  if (S.sex !== 'm') out.push({ q: 'Pregnant or breastfeeding', a: yn(S.preg) });
  const conds = askConds();
  const yes = conds.filter((c) => S.cond[c[0]] === 'y').map((c) => c[1]), notAsked = conds.filter((c) => S.cond[c[0]] == null).map((c) => c[1]);
  out.push({ q: 'Conditions', a: yes.length ? yes.join(', ') + (notAsked.length ? ' (not asked: ' + notAsked.join(', ') + ')' : '') : notAsked.length === conds.length ? '-' : notAsked.length ? 'None of those asked (not asked: ' + notAsked.join(', ') + ')' : 'None, generally healthy' });
  out.push({ q: 'On regular prescription medications', a: yn(S.meds) });
  out.push({ q: 'Current smoker / vapes / uses nicotine', a: yn(S.smoke) });
  if (String(S.alc || '').trim()) out.push({ q: 'Alcoholic drinks a week', a: String(S.alc) });
  if (S.scr) out.push({ q: 'Screening date', a: S.scr });
  if (S.away.length) out.push({ q: 'Away dates', a: S.away.map((x) => fmtR(x[0], x[1])).join(', ') });
  [['med', 'Medications logged'], ['otc', 'Supplements / OTC logged'], ['hx', 'Conditions / events logged']].forEach(([t, l]) => {
    const L = S.log.filter((e) => e.t === t);
    if (L.length) out.push({ q: l, a: L.map(logLine).join('; ') });
  });
  return out;
}

/* ---------- drawing ---------- */
function harden(doc) {
  const safe = (x) => (typeof x === 'string' ? glyphSafe(x) : Array.isArray(x) ? x.map((y) => (typeof y === 'string' ? glyphSafe(y) : y)) : x);
  ['text', 'splitTextToSize', 'getTextWidth'].forEach((fn) => {
    const orig = doc[fn];
    if (typeof orig !== 'function') return;
    doc[fn] = function (first, ...rest) { return orig.apply(doc, [safe(first), ...rest]); };
  });
  return doc;
}
/** jsPDF's Helvetica widths run about 1% narrow, and it never breaks one long word: measure to 98.8% and split long words. */
function split(doc, text, w0) {
  const w = w0 * 0.988, out = [];
  (doc.splitTextToSize(text, w) || []).forEach((line) => {
    if (doc.getTextWidth(line) <= w + 0.5) { out.push(line); return; }
    let cur = '';
    Array.from(line).forEach((ch) => { if (cur && doc.getTextWidth(cur + ch) > w) { out.push(cur); cur = ch; } else cur += ch; });
    if (cur) out.push(cur);
  });
  return out;
}

export function buildPdf(sum) {
  const doc = harden(new jsPDF({ unit: 'pt', format: 'a4' }));
  const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
  const margin = 42, contentW = pageW - margin * 2, limit = pageH - 54;
  let y = margin;
  const NAVY = [13, 48, 96], INK = [28, 32, 40], MUTED = [112, 118, 128], RULE = [222, 226, 232];
  const TAGS = {
    x: { label: 'EXCLUDE', fg: [163, 33, 47], bg: [251, 226, 228] },
    d: { label: 'DELAY OR EXCLUDE', fg: [74, 47, 160], bg: [236, 230, 251] },
    f: { label: 'DOCTOR ENQUIRY', fg: [138, 90, 0], bg: [255, 243, 214] },
  };
  const BANDS = { bad: TAGS.x, delay: TAGS.d, warn: TAGS.f, ok: { fg: [26, 122, 61], bg: [226, 245, 231] }, idle: { fg: [85, 98, 124], bg: [238, 241, 247] } };
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const ink = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const ensureSpace = (h) => { if (y + h > limit) { doc.addPage(); y = margin; } };
  const wrap = (text, w) => split(doc, cpSafe(text), w);
  function bar(title) {
    ensureSpace(34);
    fill(NAVY); doc.rect(margin, y, contentW, 20, 'F');
    font('bold', 10); doc.setTextColor(255, 255, 255);
    doc.text(cpSafe(title).toUpperCase(), margin + 8, y + 13.5);
    y += 28;
  }

  /* page 1: the clinic summary */
  try { doc.addImage(LOGO, 'PNG', margin, y, 84, 16.24); y += 28; } catch (e) { /* the logo is a nicety */ }
  const PINK = [176, 6, 106], PINK_BG = [252, 231, 243];
  if (sum.test) {
    fill(PINK_BG); doc.setDrawColor(PINK[0], PINK[1], PINK[2]); doc.setLineWidth(1.2); doc.rect(margin, y, contentW, 34, 'FD');
    font('bold', 12); ink(PINK); doc.text('TEST, NOT A REAL PRE-SCREEN', margin + 12, y + 15);
    font('normal', 9); doc.text('Made in RAYDAR\'s test mode. Don\'t file it, book from it or send it to the doctors.', margin + 12, y + 27);
    y += 46;
  }
  font('bold', 8.5); ink(MUTED); doc.text('RAYDAR PRE-SCREEN', margin, y + 8);
  font('bold', 21); ink(NAVY); doc.text(cpSafe(sum.code), margin, y + 31);
  font('normal', 10.5); ink(MUTED);
  const popLines = wrap(sum.pop, contentW * 0.68);
  doc.text(popLines, margin, y + 46);
  const headH = 46 + popLines.length * 12;
  if (sum.pid) {
    font('bold', 8.5); ink(MUTED); doc.text('CLINIBASE PID', pageW - margin, y + 8, { align: 'right' });
    font('bold', 21); ink(NAVY); doc.text(cpSafe(sum.pid), pageW - margin, y + 31, { align: 'right' });
  }
  if (sum.rev > 1) { font('bold', 9); ink(TAGS.f.fg); doc.text('REVISION ' + sum.rev + ' (amended after the first PDF)', pageW - margin, y + 46, { align: 'right' }); }
  y += headH + 6;

  const band = BANDS[sum.verdictKind] || BANDS.idle;
  font('bold', 13.5);
  const vLines = wrap(sum.verdictLabel, contentW - 30), vH = vLines.length * 17 + 16;
  fill(band.bg); doc.roundedRect(margin, y, contentW, vH, 3, 3, 'F');
  fill(band.fg); doc.rect(margin, y, 6, vH, 'F');
  ink(band.fg); doc.text(vLines, margin + 18, y + 8 + 13);
  y += vH + 8;
  if (sum.isCallback) {
    font('bold', 11);
    const cbL = wrap('CALLBACK NEEDED' + (sum.callbackReason ? ': ' + sum.callbackReason : ''), contentW - 24), cbH = cbL.length * 14 + 12;
    fill(BANDS.idle.bg); doc.roundedRect(margin, y, contentW, cbH, 3, 3, 'F');
    fill(BANDS.idle.fg); doc.rect(margin, y, 6, cbH, 'F');
    ink(BANDS.idle.fg); doc.text(cbL, margin + 18, y + 6 + 11);
    y += cbH + 8;
  }

  font('normal', 8.5); ink(MUTED);
  const meta = ['Generated ' + new Date().toLocaleString('en-AU')];
  if (sum.prevFile) meta.push('Replaces ' + sum.prevFile);
  if (sum.cohorts.length) meta.push('Cohort: ' + sum.cohorts.join(', '));
  if (sum.s) meta.push('Study notes reviewed: ' + (sum.notesReviewed ? 'Yes' : 'No'));
  meta.push(BUILD + (SOURCE.builtAt ? ' (' + SOURCE.builtAt + ')' : ''));
  const metaLines = wrap(meta.join('   |   '), contentW);
  doc.text(metaLines, margin, y + 8); y += metaLines.length * 11 + 6;

  // jump-to links: drawn at the end once page numbers are known; the space is kept now
  const notePages = sum.s ? (sum.s.notes || []).map((n) => ({ ...n, blocks: n.blocks.filter(noteShows) })).filter((n) => n.blocks.some((b) => htmlText(b.html))) : [];
  const targetDefs = [{ key: 'attn', label: 'Needs attention' }];
  if (sum.rows.length) targetDefs.push({ key: 'ans', label: 'Answers' });
  if (sum.quickRows.length) targetDefs.push({ key: 'quick', label: 'Quick Check' });
  if (notePages.length) targetDefs.push({ key: 'notes', label: 'Study notes' });
  function layoutTargets(labels) {
    font('bold', 9);
    const pos = []; let tx = margin + 46, row = 0;
    labels.forEach((l) => {
      const w = doc.getTextWidth(l);
      if (tx + w + 10 > margin + contentW && tx > margin + 46) { row++; tx = margin + 46; }
      pos.push({ x: tx, row, w }); tx += w + 18;
    });
    return { pos, rows: row + 1 };
  }
  const tocY = y, tocPage = doc.getNumberOfPages();
  y += 6 + layoutTargets(targetDefs.map((t) => t.label + '  p.99')).rows * 20;

  // participant snapshot
  const pickQ = (name) => (sum.quickRows.find((r) => r.q === name) || {}).a;
  const snap = [['DATE OF BIRTH / AGE', pickQ('Date of birth / age')], ['SEX', pickQ('Biological sex')], ['HEIGHT / WEIGHT / BMI', pickQ('Height / weight / BMI')]].filter((x) => x[1] && x[1] !== '-');
  if (snap.length) {
    const cw = contentW / snap.length;
    font('bold', 10);
    const cells = snap.map((x) => wrap(x[1], cw - 12));
    const sH = 16 + Math.max(...cells.map((c) => c.length)) * 12 + 6;
    ensureSpace(sH + 6);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.7);
    doc.line(margin, y, margin + contentW, y);
    snap.forEach((x, i) => {
      font('bold', 7.5); ink(MUTED); doc.text(x[0], margin + i * cw, y + 13);
      font('bold', 10); ink(INK); doc.text(cells[i], margin + i * cw, y + 26);
    });
    y += sH + 14;
    doc.line(margin, y - 8, margin + contentW, y - 8);
  }

  // needs attention
  const items = [], seen = new Set();
  sum.rows.forEach((r) => r.msgs.forEach((m) => { seen.add(m.m); items.push({ k: m.k, m: m.m, q: r.q, a: r.a }); }));
  sum.extra.forEach((m) => { if (!seen.has(m.m)) { seen.add(m.m); items.push({ k: m.k, m: m.m, q: '', a: '' }); } });
  const order = { x: 0, d: 1, f: 2 };
  items.sort((p, q) => order[p.k] - order[q.k]);
  const attnPage = doc.getNumberOfPages();
  bar('Needs attention' + (items.length ? ' (' + items.length + ')' : ''));
  if (!items.length) {
    font('normal', 10.5); ink(sum.verdictKind === 'ok' ? BANDS.ok.fg : MUTED);
    doc.text(sum.verdictKind === 'ok' ? 'Nothing flagged. Every answer passed.' : 'No exclusions, delays or doctor enquiries raised so far.', margin + 2, y + 4);
    y += 22;
  }
  items.forEach((it) => {
    const T = TAGS[it.k];
    font('bold', 10); const mL = wrap(it.m, contentW - 22);
    font('normal', 8.5);
    const qL = it.q ? wrap('Question: ' + cpSafe(it.q), contentW - 22) : [];
    const aL = it.a ? wrap('Answer: ' + it.a, contentW - 22) : [];
    const h = 15 + mL.length * 12.5 + (qL.length + aL.length) * 10.5 + 10;
    ensureSpace(h + 6);
    fill(T.bg); doc.rect(margin, y, contentW, h, 'F');
    fill(T.fg); doc.rect(margin, y, 4, h, 'F');
    font('bold', 7.5); ink(T.fg); doc.text(T.label, margin + 14, y + 11);
    font('bold', 10); ink(INK); doc.text(mL, margin + 14, y + 24);
    let yy = y + 24 + (mL.length - 1) * 12.5 + 13;
    font('normal', 8.5); ink([70, 76, 86]);
    if (qL.length) { doc.text(qL, margin + 14, yy); yy += qL.length * 10.5; }
    if (aL.length) doc.text(aL, margin + 14, yy);
    y += h + 6;
  });

  if (sum.notes) {
    y += 6;
    bar('Recruiter call notes');
    font('normal', 10); ink(INK);
    wrap(sum.notes, contentW - 4).forEach((l) => { ensureSpace(13); doc.text(l, margin + 2, y + 4); y += 13; });
    y += 8;
  }

  /* screening answers */
  const pages = {};
  if (sum.rows.length) {
    doc.addPage(); y = margin; pages.ans = doc.getNumberOfPages();
    bar('Screening answers');
    font('normal', 8.5);
    let lx = margin;
    [['x', 'Exclude'], ['d', 'Delay or exclude'], ['f', 'Doctor enquiry']].forEach(([k, t]) => {
      fill(TAGS[k].fg); doc.rect(lx, y - 6, 8, 8, 'F'); ink(MUTED); doc.text(t, lx + 12, y + 1); lx += 22 + doc.getTextWidth(t) + 14;
    });
    y += 13; font('normal', 8); ink(MUTED);
    doc.text('Every question is shown in full, with the answer given. Shaded rows need attention.', margin, y + 1);
    y += 14;
    let curSec = null;
    sum.rows.forEach((r) => {
      if (r.sec && r.sec !== curSec) {
        curSec = r.sec;
        ensureSpace(95);
        y += 6; font('bold', 9.5); ink(NAVY); doc.text(cpSafe(curSec), margin, y + 8);
        doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]); doc.setLineWidth(0.8); doc.line(margin, y + 12, margin + contentW, y + 12);
        y += 20;
      }
      const T = r.tag ? TAGS[r.tag] : null, W = contentW - 16, GREY = [110, 116, 126], parts = [];
      font('normal', 9.5); parts.push({ lines: wrap(r.q, W), style: 'normal', size: 9.5, color: INK, lh: 12 });
      if (r.hint) { font('italic', 8.5); parts.push({ lines: wrap(r.hint, W - 10), style: 'italic', size: 8.5, color: GREY, lh: 10.5, ind: 10 }); }
      if (r.ref) {
        parts.push({ lines: ['Reference notes'], style: 'bold', size: 8.5, color: GREY, lh: 10.5, ind: 10 });
        font('normal', 8.5); parts.push({ lines: r.ref.split('\n').flatMap((l) => wrap(l, W - 10)), style: 'normal', size: 8.5, color: GREY, lh: 10.5, ind: 10 });
      }
      if (T && r.msgs.length) { font('bold', 8.5); parts.push({ lines: wrap(r.msgs.map((m) => m.m).join(' | '), W), style: 'bold', size: 8.5, color: T.fg, lh: 11 }); }
      font('bold', 10); parts.push({ lines: wrap('Answer: ' + r.a, W), style: 'bold', size: 10, color: T ? T.fg : INK, lh: 13, gapBefore: 3 });
      const total = parts.reduce((t, i) => t + i.lines.length * i.lh + (i.gapBefore || 0), 0) + 10;
      const fits = total <= limit - margin;
      if (fits) ensureSpace(total);
      if (fits && T) { fill(T.bg); doc.rect(margin, y, contentW, total, 'F'); fill(T.fg); doc.rect(margin, y, 3, total, 'F'); }
      y += 4;
      parts.forEach((it) => {
        y += it.gapBefore || 0; font(it.style, it.size); ink(it.color);
        it.lines.forEach((l) => { if (!fits) ensureSpace(it.lh); doc.text(l, margin + 8 + (it.ind || 0), y + it.lh - 3); y += it.lh; });
      });
      y += 6;
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(margin, y, margin + contentW, y);
    });
  }

  /* quick check details */
  if (sum.quickRows.length) {
    ensureSpace(80); y += 10;
    pages.quick = doc.getNumberOfPages();
    bar('Quick Check details');
    const qW = contentW * 0.55, aX = margin + contentW * 0.6, aW = contentW * 0.4;
    sum.quickRows.forEach((r) => {
      font('normal', 9); const qL = wrap(r.q, qW - 8);
      font('bold', 9.5); const aL = wrap(cleanAns(r.a), aW);
      const h = Math.max(qL.length * 11.5, aL.length * 12) + 12;
      ensureSpace(h);
      font('normal', 9); ink(INK); doc.text(qL, margin + 8, y + 11);
      font('bold', 9.5); doc.text(aL, aX, y + 11);
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(margin, y + h, margin + contentW, y + h);
      y += h;
    });
  }

  /* study notes appendix */
  if (notePages.length) {
    doc.addPage(); y = margin; pages.notes = doc.getNumberOfPages();
    bar('Study notes (reference)');
    notePages.forEach((n) => {
      if (notePages.length > 1 || !/^study\s*notes?$/i.test(n.page)) {
        font('bold', 11); ink(NAVY);
        const hl = wrap(n.page, contentW); ensureSpace(hl.length * 13 + 30); y += 4;
        doc.text(hl, margin, y + 8); y += hl.length * 13 + 6;
      }
      n.blocks.forEach((b) => { y = drawHtml(doc, b.html, { margin, contentW, limit, y }); });
    });
  }

  /* jump-to line, bookmarks, footers */
  const total = doc.getNumberOfPages();
  pages.attn = attnPage;
  const targets = targetDefs.filter((t) => pages[t.key]).map((t) => [t.label, pages[t.key]]);
  doc.setPage(tocPage);
  font('bold', 8); ink(MUTED); doc.text('JUMP TO', margin, tocY + 14);
  const lay = layoutTargets(targets.map(([t, p]) => t + '  p.' + p));
  targets.forEach(([t, p], i) => {
    const label = t + '  p.' + p, ps = lay.pos[i], ty = tocY + ps.row * 20;
    font('bold', 9);
    fill([232, 238, 248]); doc.roundedRect(ps.x - 5, ty + 3, ps.w + 10, 16, 3, 3, 'F');
    ink([20, 70, 150]); doc.text(label, ps.x, ty + 14);
    doc.link(ps.x - 5, ty + 3, ps.w + 10, 16, { pageNumber: p });
  });
  try {
    doc.outline.add(null, 'Summary', { pageNumber: 1 });
    targets.forEach(([t, p]) => { if (!(t === 'Needs attention' && p === 1)) doc.outline.add(null, t, { pageNumber: p }); });
  } catch (e) { /* bookmarks are a nicety */ }
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(margin, pageH - 38, margin + contentW, pageH - 38);
    font('normal', 8); ink(MUTED);
    doc.text(cpSafe((sum.pid ? 'PID ' + sum.pid + '   |   ' : '') + sum.code), margin, pageH - 26);
    doc.text('Page ' + p + ' of ' + total, pageW - margin, pageH - 26, { align: 'right' });
    if (sum.test) { font('bold', 8); ink(PINK); doc.text('TEST, not a real pre-screen', pageW / 2, pageH - 26, { align: 'center' }); }
  }
  attachData(doc, buildCsv(sum));
  return doc.output('blob');
}

/** eSource study-notes HTML drawn as headings, paragraphs and bullets. */
function drawHtml(doc, html, o) {
  let { y } = o;
  const { margin, contentW, limit } = o;
  const need = (h) => { if (y + h > limit) { doc.addPage(); y = margin; } };
  const box = document.createElement('div');
  box.innerHTML = String(html || '');
  const txt = (n) => cpSafe(Array.from(n.childNodes).map((c) => (c.nodeName === 'BR' ? '\n' : c.nodeType === 3 ? c.textContent : c.nodeName === 'UL' || c.nodeName === 'OL' ? '' : txt(c))).join(''))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  const para = (text, style, size, color, ind, gap) => {
    if (!text) return;
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color[0], color[1], color[2]);
    const lines = text.split('\n').flatMap((l) => split(doc, l, contentW - ind));
    const lh = size + 2.5;
    need(Math.min(lines.length, 3) * lh + (style === 'bold' ? 30 : 4));
    lines.forEach((l) => { need(lh); doc.text(l, margin + ind, y + size); y += lh; });
    y += gap;
  };
  const list = (el, depth) => {
    Array.from(el.children).filter((c) => c.nodeName === 'LI').forEach((li) => {
      para('•  ' + txt(li).replace(/\n/g, ' '), 'normal', 9.5, [60, 60, 60], 10 + depth * 12, 2);
      Array.from(li.children).filter((c) => c.nodeName === 'UL' || c.nodeName === 'OL').forEach((sub) => list(sub, depth + 1));
    });
    y += 4;
  };
  const walk = (el) => {
    Array.from(el.childNodes).forEach((n) => {
      if (n.nodeType === 3) { para(cpSafe(n.textContent).replace(/\s+/g, ' ').trim(), 'normal', 9.5, [60, 60, 60], 6, 6); return; }
      if (n.nodeType !== 1) return;
      const tag = n.nodeName;
      if (/^H[1-6]$/.test(tag)) para(txt(n), 'bold', tag === 'H1' || tag === 'H2' ? 11 : 10, [13, 48, 96], 0, 6);
      else if (tag === 'UL' || tag === 'OL') list(n, 0);
      else if (tag === 'TABLE') Array.from(n.querySelectorAll('tr')).forEach((tr) => para(Array.from(tr.children).map(txt).join('  |  '), 'normal', 9, [60, 60, 60], 6, 2));
      else if (tag === 'P') {
        const t = txt(n), strong = n.children.length === 1 && /^(STRONG|B)$/.test(n.children[0].nodeName) && txt(n.children[0]) === t;
        para(t, strong ? 'bold' : 'normal', 9.5, strong ? [40, 40, 40] : [60, 60, 60], 6, 6);
        Array.from(n.children).filter((c) => c.nodeName === 'UL' || c.nodeName === 'OL').forEach((sub) => list(sub, 0));
      } else if (tag === 'IMG') para('[Picture in the eSource]', 'italic', 8.5, [130, 130, 130], 6, 6);
      else if (tag === 'BR') y += 4;
      else if (/^(DIV|SECTION|SPAN|STRONG|B|EM|I|U|A|FONT|BLOCKQUOTE)$/.test(tag)) {
        if (Array.from(n.children).some((c) => /^(P|UL|OL|DIV|H[1-6]|TABLE)$/.test(c.nodeName))) walk(n);
        else para(txt(n), /^(STRONG|B)$/.test(tag) ? 'bold' : 'normal', 9.5, [60, 60, 60], 6, 6);
      } else walk(n);
    });
  };
  walk(box);
  return y;
}

/* ---------- the data inside the PDF ---------- */
const cell = (v) => { v = String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

export function buildCsv(sum) {
  const s = sum.s, code = s ? s.c : '', rows = [];
  const put = (rec, key, val, st) => rows.push([rec, st == null ? code : st, key, JSON.stringify(val)]);
  put('meta', 'format', FORMAT, ''); put('meta', 'format_version', FORMAT_VERSION, ''); put('meta', 'build', BUILD, '');
  put('meta', 'raydar_version', BUILD + (SOURCE.builtAt ? ' (' + SOURCE.builtAt + ')' : ''), '');
  put('meta', 'exported_at', new Date().toISOString(), ''); put('meta', 'pid', sum.pid, '');
  if (sum.test) put('meta', 'test_mode', true, '');
  put('meta', 'kind', sum.kind, ''); put('meta', 'outcome', sum.k, ''); put('meta', 'doctor_mode', sum.dr, '');
  put('meta', 'reason', sum.callbackReason || '', ''); put('meta', 'revision', sum.rev, ''); if (sum.prevFile) put('meta', 'replaces', sum.prevFile, '');
  put('meta', 'stage', S.stage, ''); put('meta', 'study', code, ''); put('meta', 'study_file', s ? s.file : '', ''); put('meta', 'site', s ? s.site : '', '');
  // Quick Check, without the date of birth: it is asked again when the callback is reopened
  ['sex', 'wt', 'ht', 'preg', 'meds', 'smoke', 'alc', 'scr'].forEach((k) => { if (S[k] != null && S[k] !== '') put('quick', k, S[k], ''); });
  Object.entries(S.cond).forEach(([k, v]) => { if (v) put('quick', 'cond.' + k, v, ''); });
  if (S.away.length) put('quick', 'away', S.away, '');
  S.log.forEach((e, i) => put('log', String(i), { t: e.t, n: e.n, ind: e.ind, dose: e.dose, fr: e.fr || '', route: e.route, st: e.st, en: e.en, src: e.src, auto: e.auto, f: !!e.f, nm: e.nm || [] }, ''));
  if (s) {
    s.Q.forEach((q) => {
      if (S.out[q.id] != null) { put('answer', q.id, { o: S.out[q.id], a: S.ans[q.id], v: S.val[q.id] }); put('qhash', q.id, qhash(q)); }
      if (S.why[q.id] && S.why[q.id].length) put('why', q.id, S.why[q.id]);
      if (String(S.note[q.id] || '').trim()) put('comment', q.id, S.note[q.id]);
      if (S.park[q.id]) put('park', q.id, true);
    });
    if (S.read[s.c]) put('noteread', 'read', true);
    if (S.datesOk[s.c]) put('datesok', 'ok', true);
    if (S.avail[s.c]) put('avail', 'cohorts', S.avail[s.c]);
    if (S.d1[s.c]) put('d1', 'day1', S.d1[s.c]);
  }
  if (sum.notes) put('callnotes', 'text', sum.notes, '');
  const body = [MARK, ...rows.map((r) => r.map(cell).join(','))];
  body.push(['meta', '', 'row_count', JSON.stringify(rows.length + 1)].map(cell).join(','));
  return body.join('\r\n') + '\r\n';
}

function toLatin1(str) {
  // each UTF-8 byte becomes one char (<256) so jsPDF writes exactly those bytes into the attachment stream
  const bytes = new TextEncoder().encode(String(str).replace(/endstream/gi, 'end stream'));
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return out;
}
function attachData(doc, csv) {
  const data = toLatin1(csv); let fileObj = 0, specObj = 0;
  doc.internal.events.subscribe('postPutResources', function () {
    fileObj = doc.internal.newObject();
    doc.internal.write('<< /Type /EmbeddedFile /Subtype /text#2Fcsv /Params << /Size ' + data.length + ' >> /Length ' + data.length + ' >>');
    doc.internal.write('stream'); doc.internal.write(data); doc.internal.write('endstream'); doc.internal.write('endobj');
    specObj = doc.internal.newObject();
    doc.internal.write('<< /Type /Filespec /F (' + PDF_DATA_NAME + ') /UF (' + PDF_DATA_NAME + ') /Desc (RAYDAR pre-screen data. Use Import callback in RAYDAR to reopen this pre-screen.) /AFRelationship /Data /EF << /F ' + fileObj + ' 0 R /UF ' + fileObj + ' 0 R >> >>');
    doc.internal.write('endobj');
  });
  doc.internal.events.subscribe('putCatalog', function () {
    doc.internal.write('/Names << /EmbeddedFiles << /Names [(' + PDF_DATA_NAME + ') ' + specObj + ' 0 R] >> >>');
    doc.internal.write('/AF [' + specObj + ' 0 R]');
  });
}

/** Build the PDF for the outcome picked on Finish and hand it to the browser as a download. */
export function savePdf(k, opt) {
  const sum = summary(k, opt), blob = buildPdf(sum);
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = sum.fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return sum;
}

/* ---------- Import callback ---------- */
export async function extractCsv(ab) {
  const bytes = new Uint8Array(ab), s = new TextDecoder('latin1').decode(bytes);
  const utf = (b) => new TextDecoder('utf-8').decode(b).replace(/^﻿/, '').replace(/[\r\n]+$/, '') + '\r\n';
  let i = s.indexOf(MARK);
  while (i >= 0) {
    let st = i; if (st >= 3 && bytes[st - 3] === 0xef && bytes[st - 2] === 0xbb && bytes[st - 1] === 0xbf) st -= 3;
    const e = s.indexOf('endstream', i);
    if (e > i && e - st <= CSV_MAX_BYTES + 16) { const t = utf(bytes.slice(st, e)); if (t.startsWith(MARK)) return t; }
    i = s.indexOf(MARK, i + 1);
  }
  // another PDF tool may have compressed the attachment
  if (typeof DecompressionStream === 'function') {
    const re = /stream\r?\n/g; let m;
    while ((m = re.exec(s))) {
      if (s.slice(Math.max(0, m.index - 3), m.index) === 'end') continue;
      const head = s.slice(Math.max(0, m.index - 400), m.index);
      if (!/EmbeddedFile/.test(head) || !/FlateDecode/.test(head)) continue;
      const start = m.index + m[0].length, e = s.indexOf('endstream', start); if (e < 0) continue;
      try {
        const reader = new Blob([bytes.slice(start, e)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
        const parts = []; let total = 0;
        for (;;) { const r = await reader.read(); if (r.done) break; total += r.value.length; if (total > CSV_MAX_BYTES) { reader.cancel(); throw new Error('too big'); } parts.push(r.value); }
        const out = new Uint8Array(total); let o = 0; parts.forEach((p) => { out.set(p, o); o += p.length; });
        const t = utf(out); if (t.startsWith(MARK)) return t;
      } catch (err) { /* try the next stream */ }
    }
  }
  return null;
}
export function parseCsv(text) {
  const rows = []; let row = [], c = '', inQ = false, i = 0;
  const big = () => { if (c.length > CSV_MAX_CELL) throw new Error('A cell in this file is far larger than RAYDAR ever writes.'); };
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { c += '"'; i += 2; continue; } inQ = false; i++; continue; }
      c += ch; i++; big(); continue;
    }
    if (ch === '"') { if (c !== '') throw new Error('Unexpected quote in the middle of a cell.'); inQ = true; i++; continue; }
    if (ch === ',') { row.push(c); c = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(c); c = ''; i++;
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
      if (rows.length > CSV_MAX_ROWS) throw new Error('This file has far more rows than RAYDAR ever writes.');
      continue;
    }
    c += ch; i++; big();
  }
  if (inQ) throw new Error('The file ends inside a quoted cell. It looks cut off.');
  if (c !== '' || row.length) { row.push(c); rows.push(row); }
  return rows;
}
const json = (s) => { try { return { ok: true, v: JSON.parse(s) }; } catch (e) { return { ok: false }; } };

/**
 * Reopen a callback from a RAYDAR 2.7 PDF (or its CSV). Starts a new call with the PID, Quick Check, logs, study, answers
 * and notes filled in. The identity check and the date of birth are done again. Questions the eSource has changed or
 * removed since the PDF was saved are left unanswered so they get asked again.
 * Returns { ok, msg }.
 */
export async function importCallback(file) {
  const ab = await file.arrayBuffer();
  const isPdf = new TextDecoder('latin1').decode(new Uint8Array(ab, 0, Math.min(5, ab.byteLength))) === '%PDF-';
  let text;
  try { text = isPdf ? await extractCsv(ab) : new TextDecoder('utf-8').decode(ab).replace(/^﻿/, ''); } catch (e) { text = null; }
  if (!text || !text.startsWith(MARK)) return { ok: false, msg: isPdf ? 'This PDF has no RAYDAR data inside, so it can\'t be reopened. Only PDFs saved by RAYDAR carry it.' : 'This isn\'t a RAYDAR callback file.' };
  let rows;
  try { rows = parseCsv(text); } catch (e) { return { ok: false, msg: 'The data in this file can\'t be read: ' + e.message }; }
  rows = rows.slice(1).filter((r) => r.length >= 4);
  const meta = {};
  rows.filter((r) => r[0] === 'meta').forEach((r) => { const j = json(r[3]); meta[r[2]] = j.ok ? j.v : r[3]; });
  if (meta.format !== FORMAT) return { ok: false, msg: 'This isn\'t a RAYDAR callback file.' };
  const build = String(meta.build || '');
  if (!/^RAYDAR (2\.([7-9]|\d\d)|[3-9])/.test(build)) {
    const pid = String(meta.pid || '');
    return { ok: false, msg: 'This PDF was saved by RAYDAR ' + (build || 'an older version') + (pid ? ' for ' + pid : '') + '. That version names its questions differently from the eSource files this RAYDAR reads, so its answers can\'t be put back here. Reopen it in RAYDAR ' + (build || 'the version that saved it') + ' to keep its answers, or pre-screen again here.' };
  }
  if (+meta.row_count !== rows.length) return { ok: false, msg: 'The data in this file is incomplete (' + rows.length + ' of ' + meta.row_count + ' rows). It may have been cut off or edited.' };
  const st = ST.find((x) => x.c === meta.study) || ST.find((x) => meta.study_file && x.file === meta.study_file) || null;
  const keep = { fs: S.fs, sz: S.sz, col: S.col, lw: S.lw, rail: S.rail, dark: S.dark, tips: S.tips, focusMode: S.focusMode };
  const N = Object.assign(fresh(S.call + 1), keep);
  N.pid = String(meta.pid || '');
  const changed = [], dropped = [];
  let restored = 0;
  const qh = {};
  rows.filter((r) => r[0] === 'qhash').forEach((r) => { const j = json(r[3]); if (j.ok) qh[r[2]] = j.v; });
  rows.forEach((r) => {
    const [rec, , key, raw] = r, j = json(raw);
    if (!j.ok || rec === 'meta' || rec === 'qhash') return;
    const v = j.v;
    if (rec === 'quick') {
      if (key === 'away') { if (Array.isArray(v)) N.away = v.filter((a) => Array.isArray(a) && a.length === 2).map((a) => [String(a[0]), String(a[1])]); }
      else if (key.startsWith('cond.')) { if (v === 'y' || v === 'n') N.cond[key.slice(5)] = v; }
      else if (['sex', 'wt', 'ht', 'preg', 'meds', 'smoke', 'alc', 'scr'].includes(key)) N[key] = String(v);
    } else if (rec === 'log' && v && typeof v === 'object' && v.n) {
      N.log.push({ t: ['med', 'otc', 'hx'].includes(v.t) ? v.t : 'med', n: String(v.n), ind: String(v.ind || ''), dose: String(v.dose || ''), fr: String(v.fr || ''), route: String(v.route || ''), st: String(v.st || ''), en: String(v.en || ''), src: String(v.src || 'Callback'), auto: v.auto || null, f: !!v.f, nm: Array.isArray(v.nm) ? v.nm.map(String) : [] });
    } else if (rec === 'callnotes') N.finalNotes = String(v || '');
    else if (st && rec === 'answer') {
      const q = st.Q.find((z) => z.id === key);
      if (!q) { dropped.push(key); return; }
      if (qh[key] && qh[key] !== qhash(q)) { changed.push(q); return; }
      if (q.auto === 'age') return; // the date of birth isn't in the file, so the age question is asked again
      if (!v || !['c', 'd', 'x', 'n', 'i'].includes(v.o)) { changed.push(q); return; }
      if (q.kind === 'choice' && !q.auto && !q.a.some((b) => b[0] === v.a)) { changed.push(q); return; }
      N.out[key] = v.o; N.ans[key] = String(v.a == null ? '' : v.a); N.val[key] = v.v;
      if (q.kind === 'multi' && Array.isArray(v.v)) N.pick[key] = v.v.map((x) => q.a.findIndex((b) => b[2] === x)).filter((x) => x >= 0);
      if (q.kind === 'text') N.txt[key] = String(v.v == null ? '' : v.v);
      restored++;
    } else if (st && rec === 'why' && Array.isArray(v)) N.why[key] = v.map(String);
    else if (st && rec === 'comment') N.note[key] = String(v);
    else if (st && rec === 'park') N.park[key] = true;
    else if (st && rec === 'noteread') N.read[st.c] = true;
    else if (st && rec === 'datesok') N.datesOk[st.c] = true;
    else if (st && rec === 'avail' && v && typeof v === 'object') N.avail[st.c] = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, !!b]));
    else if (st && rec === 'd1') N.d1[st.c] = String(v);
  });
  if (st) {
    N.study = st; N.qon = true; N.mode = 'one';
    // a changed question's answer is dropped (questions that hang off it hide until it is answered again)
    changed.forEach((q) => { delete N.why[q.id]; });
  }
  N.rev = (+meta.revision || 1) + 1;
  N.resumed = { file: file.name, at: meta.exported_at || '', reason: meta.reason || '', study: st ? st.c : meta.study || '', missingStudy: !!meta.study && !st, restored, changed: changed.map((q) => q.s || q.id), dropped };
  N.stage = 'id';
  // a test-mode PDF reopens in test mode, with the identity check skipped
  if (meta.test_mode === true) { N.tm = true; N.tmAll = true; N.idok = true; N.stage = st ? 'ps' : 'qc'; }
  replaceS(N);
  const parts = [];
  if (st) parts.push(restored + ' answer' + (restored === 1 ? '' : 's') + ' restored for ' + st.c + '.');
  if (meta.study && !st) parts.push('The study ' + meta.study + ' isn\'t in this copy of RAYDAR, so only the Quick Check came back.');
  if (changed.length) parts.push(changed.length + ' question' + (changed.length === 1 ? ' has' : 's have') + ' changed in the eSource since, so ask ' + (changed.length === 1 ? 'it' : 'them') + ' again.');
  if (dropped.length) parts.push(dropped.length + ' answer' + (dropped.length === 1 ? ' is' : 's are') + ' for questions no longer in the eSource.');
  parts.push(meta.test_mode === true ? 'This PDF was made in test mode, so it has reopened in test mode.' : 'Re-enter the date of birth and confirm identity to continue.');
  return { ok: true, msg: parts.join(' ') };
}
