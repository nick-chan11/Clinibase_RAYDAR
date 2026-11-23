/* The studies RAYDAR offers (2.5). Built in: every eSource in "Pre-screening eSource JSONs" at build time,
   with cohort dates from "RAYDAR cohort dates.json". At run time, Tools → Study files can load more eSource
   files (or newer versions of these); they replace a built-in study with the same file name for this session. */
import { convert } from './convert.js';
import { scheduleKeyFor } from './schedule.js';
import DATES from '../../../RAYDAR cohort dates.json';

const BUILT_IN = import.meta.glob('../../../Pre-screening eSource JSONs/*.json', { eager: true, import: 'default' });

/** Live list. Mutated in place so every importer sees loaded files. */
export const ST = [];
export const SOURCE = { builtAt: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '', loaded: [] };

const order = (a, b) => (a.site + a.code).localeCompare(b.site + b.code);

/** A study code is shown as-is unless two sites run the same study: then the site is added, e.g. "OLX MEL". */
function assignCodes() {
  const n = {};
  ST.forEach((s) => (n[s.code] = (n[s.code] || 0) + 1));
  ST.forEach((s) => (s.c = n[s.code] > 1 ? s.code + ' ' + s.siteShort : s.code));
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

function put(file, json, fromFile) {
  const s = convert(file, json, DATES[file.replace(/^.*[\\/]/, '')]);
  s.loaded = !!fromFile;
  s.city = cityOf(s.site);
  s.siteLabel = siteLabel(s.site);
  // Emeritus studies recruit on a rolling basis: their visits come from the protocol schedule, not fixed cohorts
  s.sched = !s.cohorts && /emeritus/i.test(s.site) ? scheduleKeyFor(s.code) : null;
  if (s.sched) {
    const types = { tl: { l: 'Rolling recruitment', nights: 0, stay: 'Clinic day visits from Day 1', fu: '', pay: '' } };
    s.types = types;
    Object.defineProperty(s, 'cohorts', { get: () => (cohortHook ? cohortHook(s) : null), enumerable: true, configurable: true });
  }
  const i = ST.findIndex((x) => x.file === s.file);
  if (i >= 0) ST.splice(i, 1, s); else ST.push(s);
  return { s, replaced: i >= 0 };
}

Object.entries(BUILT_IN).forEach(([path, json]) => put(path, json, false));
ST.sort(order);
assignCodes();

/**
 * Load eSource files chosen in the browser. Returns one line per file for the recruiter.
 * @param files a FileList or array of File
 */
export async function loadFiles(files) {
  const out = [];
  for (const f of Array.from(files || [])) {
    if (!/\.json$/i.test(f.name)) { out.push({ file: f.name, ok: false, msg: 'Not a .json file, skipped' }); continue; }
    try {
      const json = JSON.parse(await f.text());
      if (!json || !Array.isArray(json.pages)) throw new Error('no pages in it, so it is not an eSource form');
      const { s, replaced } = put(f.name, json, true);
      out.push({ file: f.name, ok: true, msg: (replaced ? 'Updated' : 'Added') + ': ' + s.Q.length + ' steps' + (s.cohorts ? ', ' + s.cohorts.length + ' cohorts' : ', no cohort dates') + (s.issues.length ? ', ' + s.issues.length + ' thing' + (s.issues.length > 1 ? 's' : '') + ' to check' : '') });
    } catch (e) {
      out.push({ file: f.name, ok: false, msg: e instanceof SyntaxError ? 'Couldn\'t read it: the file isn\'t valid JSON. Re-export it from the eSource tool, or check the last edit.' : 'Couldn\'t read it: ' + e.message });
    }
  }
  ST.sort(order);
  assignCodes();
  SOURCE.loaded = SOURCE.loaded.concat(out);
  return out;
}
