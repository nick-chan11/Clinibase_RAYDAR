/* The studies RAYDAR offers.
   Built in: every eSource in "Pre-screening eSource JSONs" at build time, with cohort dates, visit schedules, Quick
   check settings and study settings from the RAYDAR *.json files beside it.
   2.8: a shared studies folder (Dropbox) can replace all of that at run time: the study admin publishes into the
   folder and RAYDAR reads it when it opens (src/esource/folder.js). Tools › Study files can still load single files
   for this tab only. A draft can be previewed in the recruiter screens without publishing it. */
import { convert } from './convert.js';
import { scheduleKeyFor, setScheduleData, scheduleData } from './schedule.js';
import { rulesFor, missingConditions, setConfig, QC } from './qcrules.js';
import DATES from '../../../RAYDAR cohort dates.json';
import SETTINGS_JSON from '../../../RAYDAR study settings.json';
import { useDictionary, dictionary } from '../medicines/dict.js';

const BUILT_IN = import.meta.glob('../../../Pre-screening eSource JSONs/*.json', { eager: true, import: 'default' });
const clone = (x) => JSON.parse(JSON.stringify(x));
const baseName = (p) => String(p).replace(/^.*[\\/]/, '');

/** What this file was built with, kept unchanged, to set up an empty studies folder */
const BUILT = {
  esource: Object.fromEntries(Object.entries(BUILT_IN).map(([p, j]) => [baseName(p), clone(j)])),
  dates: clone(DATES), schedules: clone(scheduleData()), qc: clone(QC.raw), settings: clone(SETTINGS_JSON),
};
const BUILT_MEDICINES = dictionary();
// the medicines dictionary is large and never edited here, so it's shared rather than copied
export const builtInData = () => ({ ...clone(BUILT), medicines: BUILT_MEDICINES });

/** Recruiter-visible studies (not paused). Mutated in place so every importer sees changes. */
export const ST = [];
/** Every study, paused ones too (the study admin) */
export const ALL = [];
export const SOURCE = { builtAt: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '', loaded: [], folder: null, preview: null };
export let SETTINGS = clone(SETTINGS_JSON);
/** 2.11: the study settings this file was built with. A studies folder published before 2.11 has no site addresses,
    so travel falls back to these (src/views/Travel.jsx). */
export const BUILT_SETTINGS = BUILT.settings;

/** file name → { json, origin: 'built-in' | 'folder' | 'loaded' | 'preview' } */
const SRC = new Map();
Object.entries(BUILT.esource).forEach(([f, j]) => SRC.set(f, { json: j, origin: 'built-in' }));

const listeners = new Set();
export const onStudiesChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

const order = (a, b) => (a.site + a.code).localeCompare(b.site + b.code);

/** A study code is shown as-is unless two sites run the same study: then the site is added, e.g. "OLX MEL". */
function assignCodes() {
  const n = {};
  ALL.forEach((s) => (n[s.code] = (n[s.code] || 0) + 1));
  ALL.forEach((s) => (s.c = n[s.code] > 1 ? s.code + ' ' + s.siteShort : s.code));
}

/* 2.6: city and site, for the site filter */
export const SITES = [
  { key: 'Emeritus Melbourne', city: 'melbourne', short: 'Emeritus Melb' },
  { key: 'Veritus', city: 'melbourne', short: 'Veritus', label: 'Veritus Melbourne' },
  { key: 'Emeritus Sydney', city: 'sydney', short: 'Emeritus Syd' },
];
export const cityOf = (site) => (/sydney/i.test(site || '') ? 'sydney' : 'melbourne');
export const siteLabel = (site) => (SITES.find((x) => x.key === site) || {}).label || site;

/* 2.6: a rolling-recruitment study's cohort is worked out from the screening date (esource/schedule.js).
   The store registers how; until then such a study has no cohorts. */
let cohortHook = null;
export const setCohortHook = (f) => { cohortHook = f; };

/** 2.7: Quick check rules, read from the study's own questions; and male- or female-only from its sex question */
function quickRules(s) {
  s.qc = rulesFor(s);
  s.qcMissing = missingConditions(s);
  const sq = s.Q.find((q) => q.auto === 'sex');
  const out = (re) => { const b = sq && sq.a.find((x) => re.test(String(x[0]).trim())); return b ? b[1] : null; };
  s.male = out(/^female\b/i) === 'x';
  s.female = out(/^male\b/i) === 'x';
}

/** One eSource → one study, with this file's dates, schedule and settings applied */
export function studyFrom(file, json, origin) {
  const s = convert(file, json, DATES[baseName(file)]);
  // a cohort still being set up in the study admin (no dates yet) isn't shown
  if (Array.isArray(s.cohorts)) { s.cohorts = s.cohorts.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.in || '') && /^\d{4}-\d{2}-\d{2}$/.test(c.out || '')); if (!s.cohorts.length) s.cohorts = null; }
  s.origin = origin || 'built-in';
  s.loaded = s.origin !== 'built-in';
  s.city = cityOf(s.site);
  s.siteLabel = siteLabel(s.site);
  const set = (SETTINGS.studies || {})[s.file] || {};
  s.paused = !!set.paused;
  s.protocolOverride = set.protocol || '';
  s.proItems = set.proItems || {}; // the prohibited items TST confirmed in the study admin (src/medicines/items.js)
  // 2.8: corrections to the prohibited lists, made in the study admin
  ['med', 'hx'].forEach((k) => {
    if (!s.pro || !s.pro[k]) return;
    if (Array.isArray(set.proSkip) && set.proSkip.length) {
      s.pro[k] = s.pro[k].filter((p) => !set.proSkip.includes(p.src));
      if (s.proNotes && s.proNotes[k]) s.proNotes[k] = s.proNotes[k].filter((n) => !set.proSkip.includes(n.name));
    }
    if (set.proKeys) s.pro[k].forEach((p) => { const kk = set.proKeys[p.n]; if (Array.isArray(kk)) p.k = kk.map((w) => String(w).toLowerCase().trim()).filter(Boolean); });
  });
  quickRules(s);
  // Emeritus studies recruit on a rolling basis: their visits come from the protocol schedule, not fixed cohorts
  s.sched = !s.cohorts && /emeritus/i.test(s.site) ? scheduleKeyFor(s.code) : null;
  if (s.sched) {
    s.types = { tl: { l: 'Rolling recruitment', nights: 0, stay: 'Clinic day visits from Day 1', fu: '', pay: '' } };
    Object.defineProperty(s, 'cohorts', { get: () => (cohortHook ? cohortHook(s) : null), enumerable: true, configurable: true });
  }
  return s;
}

/** Convert every source again (after the data behind them changed) and tell the app */
export function rebuild() {
  const next = [];
  for (const [file, { json, origin }] of SRC) {
    try { next.push(studyFrom(file, json, origin)); } catch (e) { console.error('RAYDAR: could not read ' + file, e); }
  }
  next.sort(order);
  ALL.splice(0, ALL.length, ...next);
  assignCodes();
  ST.splice(0, ST.length, ...ALL.filter((s) => !s.paused));
  listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
}
rebuild();

/* ---------- reading what's live (the study admin) ---------- */
export const liveSource = (file) => (SRC.has(file) ? clone(SRC.get(file).json) : null);
export const liveFiles = () => [...SRC.keys()];
export const liveDates = (file) => (DATES[file] ? clone(DATES[file]) : null);
export const liveData = () => ({
  esource: Object.fromEntries([...SRC].filter(([, v]) => v.origin !== 'preview').map(([f, v]) => [f, clone(v.json)])),
  dates: clone(DATES), schedules: clone(scheduleData()), qc: clone(QC.raw), settings: clone(SETTINGS), medicines: dictionary(),
});

function replaceDates(d) {
  Object.keys(DATES).forEach((k) => delete DATES[k]);
  Object.assign(DATES, clone(d || {}));
}

/**
 * 2.8: use a whole set of study data (the studies folder, or what the study admin just published).
 * The eSource files in it replace all others: the folder is the source of truth.
 */
export function useData(data, origin, meta) {
  if (!data || !data.esource || !Object.keys(data.esource).length) throw new Error('No eSource files in it');
  SRC.clear();
  Object.entries(data.esource).forEach(([f, j]) => SRC.set(baseName(f), { json: j, origin: origin || 'folder' }));
  if (data.dates) replaceDates(data.dates);
  if (data.schedules) setScheduleData(data.schedules);
  if (data.qc) setConfig(data.qc);
  if (data.settings) SETTINGS = clone(data.settings);
  // a folder's dictionary is used only when it's at least as new as the one built in
  if (data.medicines && data.medicines !== dictionary() && data.medicines.version && String(data.medicines.version.built || '') >= String((BUILT_MEDICINES.version || {}).built || '')) useDictionary(data.medicines);
  else if (origin === 'built-in') useDictionary(BUILT_MEDICINES);
  SOURCE.folder = meta || null;
  SOURCE.preview = null;
  rebuild();
}

/** Go back to the studies built into this file */
export function useBuiltIn() {
  useData(BUILT, 'built-in', null);
}

/* ---------- 2.8: previewing a draft in the recruiter screens ---------- */
let saved = null;
/** bundle: { file, esource, dates, schedule: {key, value, codes}, settings } */
export function startPreview(bundle) {
  if (!saved) saved = { src: SRC.has(bundle.file) ? SRC.get(bundle.file) : null, file: bundle.file, dates: DATES[bundle.file], sched: clone(scheduleData()), settings: clone(SETTINGS) };
  SRC.set(bundle.file, { json: bundle.esource, origin: 'preview' });
  if (bundle.dates) DATES[bundle.file] = clone(bundle.dates); else delete DATES[bundle.file];
  if (bundle.schedule && bundle.schedule.key) {
    const d = clone(scheduleData());
    d.schedules[bundle.schedule.key] = bundle.schedule.value;
    (bundle.schedule.codes || []).forEach((c) => (d.byCode[c] = bundle.schedule.key));
    setScheduleData(d);
  }
  SETTINGS = clone(SETTINGS);
  SETTINGS.studies = SETTINGS.studies || {};
  SETTINGS.studies[bundle.file] = { ...(bundle.settings || {}), paused: false };
  SOURCE.preview = bundle.file;
  rebuild();
}
export function endPreview() {
  if (!saved) return;
  if (saved.src) SRC.set(saved.file, saved.src); else SRC.delete(saved.file);
  if (saved.dates) DATES[saved.file] = saved.dates; else delete DATES[saved.file];
  setScheduleData(saved.sched);
  SETTINGS = saved.settings;
  saved = null;
  SOURCE.preview = null;
  rebuild();
}

/**
 * Load eSource files (or a Quick check settings file) chosen in the browser, for this tab only.
 * @param files a FileList or array of File
 */
export async function loadFiles(files) {
  const out = [];
  for (const f of Array.from(files || [])) {
    if (!/\.json$/i.test(f.name)) { out.push({ file: f.name, ok: false, msg: 'Not a .json file, skipped' }); continue; }
    try {
      const json = JSON.parse(await f.text());
      if (json && Array.isArray(json.conditions) && !json.pages) {
        const err = setConfig(json);
        if (err) throw new Error(err);
        rebuild();
        out.push({ file: f.name, ok: true, msg: 'Quick check settings: ' + json.conditions.length + ' conditions, ' + ST.reduce((n, x) => n + x.qc.length, 0) + ' rules across the studies' });
        continue;
      }
      if (!json || !Array.isArray(json.pages)) throw new Error('no pages in it, so it is not an eSource form');
      const replaced = SRC.has(f.name);
      SRC.set(f.name, { json, origin: 'loaded' });
      rebuild();
      const s = ALL.find((x) => x.file === f.name);
      out.push({ file: f.name, ok: true, msg: (replaced ? 'Updated' : 'Added') + ': ' + s.Q.length + ' steps' + (s.cohorts ? ', ' + s.cohorts.length + ' cohorts' : ', no cohort dates') + (s.issues.length ? ', ' + s.issues.length + ' thing' + (s.issues.length > 1 ? 's' : '') + ' to check' : '') });
    } catch (e) {
      out.push({ file: f.name, ok: false, msg: e instanceof SyntaxError ? 'Couldn\'t read it: the file isn\'t valid JSON. Re-export it from the eSource tool, or check the last edit.' : 'Couldn\'t read it: ' + e.message });
    }
  }
  SOURCE.loaded = SOURCE.loaded.concat(out);
  return out;
}
