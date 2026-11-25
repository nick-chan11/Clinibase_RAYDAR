/* RAYDAR 2.8: the shared studies folder (in Dropbox).
   It holds the same files as the repo, so the study admin, RAYDAR and the Claude study skills all use one layout:
     Pre-screening eSource JSONs/*.json
     RAYDAR cohort dates.json · RAYDAR visit schedules.json · RAYDAR quick check.json · RAYDAR study settings.json
     RAYDAR medicines.json (optional: a newer medicines dictionary than the one built into the file)
     _drafts/   the study admin's unpublished drafts
     _history/  a copy of every publish, to see who changed what and to roll back
   Chrome lets a page open a folder (File System Access API) and remember it; it asks again for permission after a
   restart, which needs one click. Browsers without it can still read a folder through a folder picker (read only). */

export const ESOURCE_DIR = 'Pre-screening eSource JSONs';
export const FILES = { dates: 'RAYDAR cohort dates.json', schedules: 'RAYDAR visit schedules.json', qc: 'RAYDAR quick check.json', settings: 'RAYDAR study settings.json', medicines: 'RAYDAR medicines.json' };
export const canOpenFolders = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/* ---- remembering the folder (IndexedDB; any failure just means "ask again") ---- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('raydar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('handles');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key, val) {
  try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('handles', 'readwrite'); val == null ? t.objectStore('handles').delete(key) : t.objectStore('handles').put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { /* not remembered: it will ask again */ }
}
async function idbGet(key) {
  try { const db = await idb(); return await new Promise((res) => { const r = db.transaction('handles').objectStore('handles').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; }
}

/** Ask the person to pick the studies folder. Remembers it for next time. */
export async function pickFolder() {
  const h = await window.showDirectoryPicker({ id: 'raydar-studies', mode: 'readwrite' });
  await idbSet('studies', h);
  return h;
}
export const savedFolder = () => idbGet('studies');
export const forgetFolder = () => idbSet('studies', null);

/** 'granted', 'prompt' or 'denied'. With ask=true it shows Chrome's prompt (needs a click from the person). */
export async function permission(h, write, ask) {
  const opts = { mode: write ? 'readwrite' : 'read' };
  try {
    let p = await h.queryPermission(opts);
    if (p !== 'granted' && ask) p = await h.requestPermission(opts);
    return p;
  } catch (e) { return 'denied'; }
}

/* ---- reading ---- */
async function dir(h, path, create) {
  let d = h;
  for (const part of path) d = await d.getDirectoryHandle(part, { create: !!create });
  return d;
}
async function readJsonAt(d, name) {
  try { const f = await (await d.getFileHandle(name)).getFile(); return JSON.parse(await f.text()); } catch (e) {
    if (e && e.name === 'NotFoundError') return null;
    throw new Error(name + ': ' + (e instanceof SyntaxError ? 'not valid JSON' : e.message));
  }
}
export async function listJson(h, path) {
  try {
    const d = await dir(h, path);
    const out = [];
    for await (const [name, e] of d.entries()) if (e.kind === 'file' && /\.json$/i.test(name)) out.push(name);
    return out.sort();
  } catch (e) { return []; }
}
export async function readAt(h, path, name) {
  try { return await readJsonAt(await dir(h, path), name); } catch (e) { return null; }
}

/** Everything RAYDAR needs from the folder: { esource: {file: json}, dates, schedules, qc, settings, problems } */
export async function readFolder(h) {
  const esource = {}, problems = [];
  let ed = null;
  try { ed = await dir(h, [ESOURCE_DIR]); } catch (e) { /* no eSource folder: empty or not a studies folder */ }
  if (ed) {
    for await (const [name, e] of ed.entries()) {
      if (e.kind !== 'file' || !/\.json$/i.test(name)) continue;
      try { const j = JSON.parse(await (await e.getFile()).text()); if (j && Array.isArray(j.pages)) esource[name] = j; else problems.push(name + ': not an eSource form'); } catch (err) { problems.push(name + ': not valid JSON'); }
    }
  }
  const out = { esource, problems };
  for (const [k, name] of Object.entries(FILES)) {
    try { out[k] = await readJsonAt(h, name); } catch (e) { problems.push(e.message); out[k] = null; }
  }
  return out;
}

/** Read a folder chosen with <input type=file webkitdirectory> (any browser; read only) */
export async function readPicked(fileList) {
  const esource = {}, problems = [], out = { esource, problems };
  for (const f of Array.from(fileList || [])) {
    const parts = (f.webkitRelativePath || f.name).split('/');
    const name = parts[parts.length - 1];
    if (!/\.json$/i.test(name) || parts.includes('_drafts') || parts.includes('_history')) continue;
    let j;
    try { j = JSON.parse(await f.text()); } catch (e) { problems.push(name + ': not valid JSON'); continue; }
    if (parts.includes(ESOURCE_DIR)) { if (j && Array.isArray(j.pages)) esource[name] = j; continue; }
    const k = Object.keys(FILES).find((x) => FILES[x] === name);
    if (k) out[k] = j;
  }
  return out;
}

/* ---- writing ---- */
export async function writeJson(h, path, name, data) {
  const d = await dir(h, path, true);
  const fh = await d.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(data, null, 2) + '\n');
  await w.close();
}
export async function removeFile(h, path, name) {
  try { await (await dir(h, path)).removeEntry(name); } catch (e) { /* already gone */ }
}

/** Fill an empty folder with a whole set of study data (the studies built into this RAYDAR) */
export async function writeAll(h, data) {
  for (const [file, json] of Object.entries(data.esource)) await writeJson(h, [ESOURCE_DIR], file, json);
  for (const [k, name] of Object.entries(FILES)) if (data[k]) await writeJson(h, [], name, data[k]);
}

/** A name safe for a file in _history: 2026-11-24 10.42.05 by Sam.json */
export function stampName(by) {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + '.' + p(d.getMinutes()) + '.' + p(d.getSeconds()) + (by ? ' by ' + String(by).replace(/[^A-Za-z0-9 _-]+/g, '').slice(0, 40) : '') + '.json';
}

/** No folder (or no write access): hand the file to the browser as a download */
export function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---- 2.8: the studies file in _system (read by RAYDAR with no folder permission, the way RAYDAR Original reads its
   "newest version" pointer). Every publish rewrites both files:
     _system/raydar_studies.js          window.RAYDAR_STUDIES = { version, by, data: { esource, dates, schedules, qc, settings } }
     _system/raydar_studies_version.js  window.RAYDAR_STUDIES_VERSION = { version, by }   (tiny, checked every few minutes)
   A RAYDAR file opened from the same Dropbox folder loads them with a plain <script src>, which works from a
   double-clicked file in any browser. ---- */
export const SYSTEM_DIR = '_system', BUNDLE = 'raydar_studies.js', BUNDLE_VERSION = 'raydar_studies_version.js';
export async function writeText(h, path, name, text) {
  const d = await dir(h, path, true);
  const fh = await d.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}
/** Rebuild the studies file from what's in the folder now. Returns its version. */
export async function writeBundle(h, by) {
  const d = await readFolder(h);
  if (!Object.keys(d.esource).length) throw new Error('No eSource files in the folder, so there is nothing to put in the studies file');
  const version = new Date().toISOString();
  const head = { version, by: by || '' };
  const data = { esource: d.esource, dates: d.dates, schedules: d.schedules, qc: d.qc, settings: d.settings };
  if (d.medicines) data.medicines = d.medicines; // the medicines dictionary, when the folder has one
  // the version file is written last, so a RAYDAR that sees the new version always finds the new studies file
  await writeText(h, [SYSTEM_DIR], BUNDLE, '/* RAYDAR studies, written by the study admin. Do not edit by hand: publish from the study admin instead. */\nwindow.RAYDAR_STUDIES = ' + JSON.stringify({ ...head, data }) + ';\n');
  await writeText(h, [SYSTEM_DIR], BUNDLE_VERSION, 'window.RAYDAR_STUDIES_VERSION = ' + JSON.stringify(head) + ';\n');
  return version;
}
