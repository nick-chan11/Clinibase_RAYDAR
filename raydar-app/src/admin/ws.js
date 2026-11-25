/* RAYDAR 2.8 study admin: the working copy ("workspace"). Each study being edited is a draft bundle:
     { file, esource, dates, schedule: { key, value, codes } | null, settings, isNew }
   Drafts autosave to the studies folder (_drafts/) or, without one, to this browser. Publishing writes the study's
   files into the studies folder, keeps a copy in _history/, and RAYDAR picks it up the next time it reads the folder. */
import { useSyncExternalStore } from 'react';
import { ALL, SETTINGS, liveSource, liveDates, liveData, useData, startPreview, endPreview, rebuild } from '../esource/studies.js';
import { SCHEDULES, scheduleKeyFor, scheduleData } from '../esource/schedule.js';
import { convert, nameParts } from '../esource/convert.js';
import { QC, parseConfig, rulesFor, missingConditions } from '../esource/qcrules.js';
import { FOLDER, reload, setLoadedVersion } from '../esource/connect.js';
import { ESOURCE_DIR, FILES, writeJson, readAt, listJson, removeFile, stampName, download, writeBundle } from '../esource/folder.js';

/** 2.8: after every publish, rewrite the studies file in _system that recruiters' RAYDAR reads */
export async function rebundle() {
  if (!(FOLDER.write && FOLDER.handle)) return null;
  const v = await writeBundle(FOLDER.handle, W.name);
  FOLDER.bundle = { version: v, by: W.name || '' };
  setLoadedVersion(v);
  return v;
}
import { clone } from './ops.js';

const listeners = new Set();
let version = 0;
const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const notify = () => { version++; listeners.forEach((f) => f()); };
export const useWS = () => useSyncExternalStore(subscribe, () => version);

const NAME_KEY = 'raydar.admin.name', LOCAL_DRAFTS = 'raydar.admin.drafts';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };

export const W = {
  view: 'studies', file: null, tab: 'questions', page: 1, sel: null,
  name: ls.get(NAME_KEY) || '',
  drafts: {}, undo: {}, redo: {},
  qc: clone(QC.raw), qcDirty: false,
  previewing: false, msg: null, busy: false, dialog: null, unlocked: false,
};
/* 2.8: unpublished Quick check changes are kept like a draft (studies folder _drafts, or this browser) */
const QC_DRAFT = '_quick check.json', LOCAL_QC = 'raydar.admin.qcdraft';
let qcTimer = null;
export function markQc() { W.qcDirty = true; notify(); clearTimeout(qcTimer); qcTimer = setTimeout(saveQcDraft, 500); }
async function saveQcDraft() {
  try {
    if (FOLDER.write && FOLDER.handle) {
      if (W.qcDirty) await writeJson(FOLDER.handle, ['_drafts'], QC_DRAFT, { qc: W.qc, savedBy: W.name, savedAt: new Date().toISOString() });
      else await removeFile(FOLDER.handle, ['_drafts'], QC_DRAFT);
    } else if (W.qcDirty) ls.set(LOCAL_QC, JSON.stringify(W.qc));
    else { try { localStorage.removeItem(LOCAL_QC); } catch (e) { /* nothing kept */ } }
  } catch (e) { say('The Quick check changes couldn\'t be saved as a draft: ' + e.message, 'warn'); }
}
function qcPublished() { W.qcDirty = false; saveQcDraft(); }

export function setName(n) { W.name = String(n || '').trim(); ls.set(NAME_KEY, W.name); notify(); }
export function say(text, kind) { W.msg = text ? { text, kind: kind || 'ok' } : null; notify(); }

export const SITES = ['Emeritus Melbourne', 'Emeritus Sydney', 'Veritus'];
export const fileFor = (site, code) => site + ' - ' + String(code).trim() + ' - pre-screening.json';
const histDir = (file) => file.replace(/\.json$/i, '');

/* ---- what's live, as a bundle ---- */
export function liveBundle(file) {
  const esource = liveSource(file);
  if (!esource) return null;
  const dates = liveDates(file);
  const { site, code } = nameParts(file, esource);
  let schedule = null;
  if (!dates && /emeritus/i.test(site)) {
    const key = scheduleKeyFor(code);
    if (key && SCHEDULES[key]) schedule = { key, value: clone(SCHEDULES[key]), codes: Object.entries(scheduleData().byCode).filter(([, k]) => k === key).map(([c]) => c) };
  }
  return { file, esource, dates, schedule, settings: clone((SETTINGS.studies || {})[file] || {}), isNew: false };
}
const sig = (b) => JSON.stringify([b.esource, b.dates || null, b.schedule || null, b.settings || {}]);
/** Has this draft changed anything compared with what's live? */
export function changed(file) {
  const d = W.drafts[file];
  if (!d) return false;
  if (d.isNew) return true;
  const live = liveBundle(file);
  return !live || sig(live) !== sig(d);
}
export function draftFor(file) {
  if (!W.drafts[file]) { const b = liveBundle(file); if (b) W.drafts[file] = b; }
  return W.drafts[file] || null;
}

/* ---- the converted draft, to check and preview ---- */
const memo = new Map();
export function draftStudy(b) {
  const key = sig(b) + JSON.stringify(W.qc);
  if (memo.has(key)) return memo.get(key);
  let s;
  try {
    s = convert(b.file, b.esource, b.dates || undefined);
    const set = b.settings || {};
    s.proItems = set.proItems || {};
    ['med', 'hx'].forEach((k) => {
      if (!s.pro || !s.pro[k]) return;
      s.proAll = s.proAll || {}; s.proAll[k] = s.pro[k].slice();
      if (Array.isArray(set.proSkip)) s.pro[k] = s.pro[k].filter((p) => !set.proSkip.includes(p.src));
      if (set.proKeys) s.pro[k].forEach((p) => { if (Array.isArray(set.proKeys[p.n])) p.k = set.proKeys[p.n]; });
    });
    const cfg = parseConfig(W.qc);
    s.qc = rulesFor(s, cfg);
    s.qcMissing = missingConditions(s, cfg);
  } catch (e) { s = { error: e.message, Q: [], issues: [], notes: [] }; }
  if (memo.size > 40) memo.clear();
  memo.set(key, s);
  return s;
}

/* ---- editing ---- */
let saveTimer = null;
/** Change the open draft. what: 'esource' keeps an undo step. */
export function edit(fn, what) {
  const b = W.drafts[W.file];
  if (!b) return;
  // a burst of typing ('typing') is one undo step, not one per letter; any other change is its own step
  const now = Date.now(), typing = what === 'typing';
  const burst = typing && W.lastTyping && now - W.lastEdit < 1200;
  if (what === 'esource' || typing) { W.lastEdit = now; W.lastTyping = typing; }
  if ((what === 'esource' || typing) && !burst) {
    (W.undo[W.file] = W.undo[W.file] || []).push(JSON.stringify(b.esource));
    if (W.undo[W.file].length > 60) W.undo[W.file].shift();
    W.redo[W.file] = [];
  }
  fn(b);
  notify();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDraft(b.file), 700);
}
export function undo() {
  const u = W.undo[W.file]; if (!u || !u.length) return;
  const b = W.drafts[W.file];
  (W.redo[W.file] = W.redo[W.file] || []).push(JSON.stringify(b.esource));
  b.esource = JSON.parse(u.pop()); W.lastTyping = false; notify(); saveDraft(W.file);
}
export function redo() {
  const r = W.redo[W.file]; if (!r || !r.length) return;
  const b = W.drafts[W.file];
  W.undo[W.file].push(JSON.stringify(b.esource));
  b.esource = JSON.parse(r.pop()); W.lastTyping = false; notify(); saveDraft(W.file);
}

/* ---- drafts: saved in the folder, or this browser ---- */
export async function saveDraft(file) {
  const b = W.drafts[file];
  if (!b) return;
  const keep = changed(file);
  try {
    if (FOLDER.write && FOLDER.handle) {
      if (keep) await writeJson(FOLDER.handle, ['_drafts'], file, { ...b, savedBy: W.name, savedAt: new Date().toISOString() });
      else await removeFile(FOLDER.handle, ['_drafts'], file);
    } else {
      const all = JSON.parse(ls.get(LOCAL_DRAFTS) || '{}');
      if (keep) all[file] = b; else delete all[file];
      if (!ls.set(LOCAL_DRAFTS, JSON.stringify(all))) say('The draft couldn\'t be saved in this browser (storage full or blocked). Connect the studies folder to keep drafts.', 'warn');
    }
  } catch (e) { say('The draft couldn\'t be saved: ' + e.message, 'warn'); }
}
export async function loadDrafts() {
  const found = {};
  try {
    if (FOLDER.handle && FOLDER.status === 'connected') {
      for (const f of await listJson(FOLDER.handle, ['_drafts'])) { const d = await readAt(FOLDER.handle, ['_drafts'], f); if (d && d.esource) found[f] = d; }
    } else Object.assign(found, JSON.parse(ls.get(LOCAL_DRAFTS) || '{}'));
  } catch (e) { /* no drafts */ }
  // the unpublished Quick check changes, if any
  try {
    let q = null;
    if (FOLDER.handle && FOLDER.status === 'connected') { const d = await readAt(FOLDER.handle, ['_drafts'], QC_DRAFT); q = d && d.qc; delete found[QC_DRAFT]; }
    else q = JSON.parse(ls.get(LOCAL_QC) || 'null');
    if (q && Array.isArray(q.conditions) && !W.qcDirty) { W.qc = q; W.qcDirty = true; }
  } catch (e) { /* none */ }
  Object.entries(found).forEach(([f, d]) => { if (!W.drafts[f]) W.drafts[f] = { file: f, esource: d.esource, dates: d.dates || null, schedule: d.schedule || null, settings: d.settings || {}, isNew: !!d.isNew, savedBy: d.savedBy, savedAt: d.savedAt }; });
  notify();
}
export async function discardDraft(file) {
  delete W.drafts[file]; delete W.undo[file]; delete W.redo[file];
  await saveDraftRemove(file);
  if (W.file === file) { W.file = null; W.view = 'studies'; }
  notify();
}
async function saveDraftRemove(file) {
  try {
    if (FOLDER.write && FOLDER.handle) await removeFile(FOLDER.handle, ['_drafts'], file);
    else { const all = JSON.parse(ls.get(LOCAL_DRAFTS) || '{}'); delete all[file]; ls.set(LOCAL_DRAFTS, JSON.stringify(all)); }
  } catch (e) { /* nothing to remove */ }
}

/* ---- studies list ---- */
export function studyRows() {
  const rows = ALL.map((s) => ({ file: s.file, s, live: true, draft: changed(s.file), paused: !!s.paused }));
  Object.values(W.drafts).filter((d) => d.isNew && !rows.find((r) => r.file === d.file)).forEach((d) => {
    const { site, code } = nameParts(d.file, d.esource);
    rows.push({ file: d.file, s: { code, site, file: d.file, d: d.esource.title || code }, live: false, draft: true, paused: false });
  });
  return rows.sort((a, b) => (a.draft === b.draft ? (a.s.site + a.s.code).localeCompare(b.s.site + b.s.code) : a.draft ? -1 : 1));
}
export function openStudy(file, tab) {
  if (!draftFor(file)) return say('That study isn\'t loaded.', 'warn');
  W.file = file; W.view = 'study'; W.tab = tab || 'questions'; W.sel = null;
  const pages = W.drafts[file].esource.pages || [];
  const i = pages.findIndex((p) => !/study\s*notes?/i.test(p.title || p.name || ''));
  W.page = i >= 0 ? i : 0;
  notify();
}
export function createStudy(site, code, title, esource) {
  const file = fileFor(site, code);
  if (ALL.find((s) => s.file === file) || W.drafts[file]) return say('There is already a study called ' + code + ' at ' + site + '.', 'warn');
  W.drafts[file] = { file, esource, dates: null, schedule: null, settings: {}, isNew: true };
  saveDraft(file);
  openStudy(file);
  return file;
}
export function copyStudy(file, site, withDates) {
  const b = draftFor(file);
  const { code } = nameParts(file, b.esource);
  const to = fileFor(site, code);
  if (ALL.find((s) => s.file === to) || W.drafts[to]) return say(code + ' already exists at ' + site + '. Open it and publish the change there instead.', 'warn');
  W.drafts[to] = { file: to, esource: clone(b.esource), dates: withDates && b.dates ? clone(b.dates) : null, schedule: b.schedule ? clone(b.schedule) : null, settings: clone(b.settings || {}), isNew: true };
  saveDraft(to);
  openStudy(to);
  say('Copied to ' + site + '. Check its dates and site details, then publish it.');
}

/* ---- publishing ---- */
async function readLive(name, fallback) {
  const v = FOLDER.handle && FOLDER.status === 'connected' ? await readAt(FOLDER.handle, [], name) : null;
  return v || fallback;
}
/** Write the study (and the shared files it touches) into the folder, keep a history copy, read the folder again. */
export async function publish(file, opt) {
  const b = W.drafts[file];
  if (!b) return { ok: false, msg: 'Nothing to publish' };
  if (!W.name) return { ok: false, msg: 'Enter your name first: it is recorded with the publish.' };
  W.busy = true; notify();
  const live = liveData();
  try {
    const dates = clone(await readLive(FILES.dates, live.dates));
    if (b.dates) dates[file] = b.dates; else delete dates[file];
    const sched = clone(await readLive(FILES.schedules, live.schedules));
    if (b.schedule && b.schedule.key) { sched.schedules[b.schedule.key] = b.schedule.value; (b.schedule.codes || []).forEach((c) => { if (c) sched.byCode[c] = b.schedule.key; }); }
    const settings = clone(await readLive(FILES.settings, live.settings));
    settings.studies = settings.studies || {};
    settings.studies[file] = b.settings || {};
    if (opt.note && opt.note.trim()) (settings.news = settings.news || []).push({ id: Date.now().toString(36), at: new Date().toISOString(), text: opt.note.trim(), studies: [file] });
    if (settings.news && settings.news.length > 30) settings.news = settings.news.slice(-30);
    const record = { at: new Date().toISOString(), by: W.name, approvedBy: opt.noSecond ? '' : opt.approver || '', secondCheck: !opt.noSecond, note: opt.note || '', file, bundle: { esource: b.esource, dates: b.dates || null, schedule: b.schedule || null, settings: b.settings || {} } };
    const others = (opt.alsoTo || []).filter(Boolean);
    if (FOLDER.write && FOLDER.handle) {
      const h = FOLDER.handle;
      await writeJson(h, [ESOURCE_DIR], file, b.esource);
      for (const o of others) { await writeJson(h, [ESOURCE_DIR], o, b.esource); await writeJson(h, ['_history', histDir(o)], stampName(W.name), { ...record, file: o, copiedFrom: file }); }
      await writeJson(h, [], FILES.dates, dates);
      await writeJson(h, [], FILES.schedules, sched);
      await writeJson(h, [], FILES.settings, settings);
      if (W.qcDirty) { await writeJson(h, [], FILES.qc, W.qc); qcPublished(); }
      await writeJson(h, ['_history', histDir(file)], stampName(W.name), record);
      await removeFile(h, ['_drafts'], file);
      delete W.drafts[file]; delete W.undo[file]; delete W.redo[file];
      await rebundle();
      const r = await reload();
      if (!r.ok) throw new Error(r.msg);
      W.busy = false;
      say('Published ' + file.replace(/ - pre-screening\.json$/, '') + (others.length ? ' (and ' + others.length + ' other site)' : '') + '. Recruiters\' RAYDAR picks it up within a few minutes.');
      return { ok: true };
    }
    // No folder to write to: the files come down as downloads, and this tab uses them straight away
    const esource = { ...live.esource, [file]: b.esource };
    others.forEach((o) => (esource[o] = b.esource));
    download(file, b.esource);
    others.forEach((o) => download(o, b.esource));
    download(FILES.dates, dates); download(FILES.schedules, sched); download(FILES.settings, settings);
    if (W.qcDirty) { download(FILES.qc, W.qc); qcPublished(); }
    download(stampName(W.name).replace(/\.json$/, '') + ' - ' + histDir(file) + ' (history).json', record);
    useData({ esource, dates, schedules: sched, qc: W.qc, settings }, 'loaded', null);
    await saveDraftRemove(file);
    delete W.drafts[file];
    W.busy = false;
    say('No studies folder is connected, so the changed files were downloaded. Put them in the studies folder (eSource files in "' + ESOURCE_DIR + '"). This tab already uses them.', 'warn');
    return { ok: true };
  } catch (e) {
    W.busy = false; notify();
    return { ok: false, msg: 'Publishing stopped: ' + e.message };
  }
}

/** Quick check settings on their own (the Quick check page) */
export async function publishQc() {
  if (!W.name) return say('Enter your name first.', 'warn');
  try {
    if (FOLDER.write && FOLDER.handle) {
      await writeJson(FOLDER.handle, [], FILES.qc, W.qc);
      await writeJson(FOLDER.handle, ['_history', '_quick check'], stampName(W.name), { at: new Date().toISOString(), by: W.name, qc: W.qc });
      qcPublished();
      await rebundle();
      await reload();
      say('Quick check settings published.');
    } else {
      download(FILES.qc, W.qc); qcPublished();
      useData({ ...liveData(), qc: W.qc }, 'loaded', null);
      say('No studies folder is connected, so the file was downloaded. Put it in the studies folder.', 'warn');
    }
  } catch (e) { say('Couldn\'t publish: ' + e.message, 'warn'); }
}

/** Pause or resume a study straight away (hides it from recruiters; nothing else changes) */
export async function setPaused(file, paused) {
  if (!W.name) return say('Enter your name first.', 'warn');
  try {
    const settings = clone(await readLive(FILES.settings, liveData().settings));
    settings.studies = settings.studies || {};
    settings.studies[file] = { ...(settings.studies[file] || {}), paused: !!paused };
    if (!paused) delete settings.studies[file].paused;
    if (FOLDER.write && FOLDER.handle) {
      await writeJson(FOLDER.handle, [], FILES.settings, settings);
      await writeJson(FOLDER.handle, ['_history', histDir(file)], stampName(W.name), { at: new Date().toISOString(), by: W.name, file, action: paused ? 'paused' : 'resumed' });
      await rebundle();
      await reload();
    } else {
      download(FILES.settings, settings);
      useData({ ...liveData(), settings }, 'loaded', null);
    }
    if (W.drafts[file]) W.drafts[file].settings = { ...(W.drafts[file].settings || {}), paused: !!paused };
    const nm = file.replace(/ - pre-screening\.json$/, '');
    say(paused ? 'Paused: recruiters no longer see ' + nm + '. Resume it from the studies list.' : 'Resumed: recruiters see ' + nm + ' again.');
  } catch (e) { say('Couldn\'t change it: ' + e.message, 'warn'); }
}

/** Admin settings kept in the study settings file (the all-in-one file's PIN) */
export async function saveSetting(key, value) {
  const settings = clone(await readLive(FILES.settings, liveData().settings));
  settings[key] = value;
  if (FOLDER.write && FOLDER.handle) { await writeJson(FOLDER.handle, [], FILES.settings, settings); await rebundle(); await reload(); }
  else { download(FILES.settings, settings); useData({ ...liveData(), settings }, 'loaded', null); }
}

/* ---- history ---- */
export async function history(file) {
  if (!FOLDER.handle || FOLDER.status !== 'connected') return [];
  const names = await listJson(FOLDER.handle, ['_history', histDir(file)]);
  return names.reverse();
}
export async function openFromHistory(file, entry) {
  const r = await readAt(FOLDER.handle, ['_history', histDir(file)], entry);
  if (!r || !r.bundle) return say('That history entry has no study in it (it records a pause or resume).', 'warn');
  W.drafts[file] = { file, esource: r.bundle.esource, dates: r.bundle.dates, schedule: r.bundle.schedule, settings: r.bundle.settings || {}, isNew: !ALL.find((s) => s.file === file) };
  saveDraft(file);
  openStudy(file, 'publish');
  say('Opened the version from ' + entry.replace(/\.json$/, '') + ' as a draft. Publish it to roll back.');
}

/* ---- preview in the recruiter screens ---- */
let restoreCall = null;
export function beginPreview(bundle, saveCall) {
  restoreCall = saveCall || null;
  startPreview({ file: bundle.file, esource: bundle.esource, dates: bundle.dates, schedule: bundle.schedule, settings: bundle.settings });
  W.previewing = true; notify();
}
export function finishPreview() {
  endPreview();
  W.previewing = false;
  const r = restoreCall; restoreCall = null;
  if (r) r();
  notify();
}
export { rebuild };
