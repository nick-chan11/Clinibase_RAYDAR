/* RAYDAR 2.8: connecting to the shared studies folder, for the recruiter screens and the study admin alike.
   FOLDER is what the screens show; every change notifies listeners (the store re-renders).
   Two ways in:
   - the studies file in _system, next to this RAYDAR file in the same Dropbox folder: read with a plain <script src>,
     like RAYDAR Original's "newer version" pointer. No permission, any browser, nothing to click. This is the
     recruiters' way.
   - the folder itself (Chrome's folder access): needed to save, so it's the study admin's way.
   RAYDAR checks _system/raydar_studies_version.js every few minutes and when its tab is brought back, so a publish
   reaches a RAYDAR that's been open all day. */
import { canOpenFolders, pickFolder, savedFolder, forgetFolder, permission, readFolder, readPicked, SYSTEM_DIR, BUNDLE, BUNDLE_VERSION } from './folder.js';
import { useData, useBuiltIn, SOURCE, ALL } from './studies.js';

/** status: 'built-in' (no folder) · 'file' (the studies file in _system) · 'needs-click' (remembered, Chrome wants a
    click) · 'connected' (folder access) · 'read-only' (picked via the fallback) */
export const FOLDER = { status: 'built-in', name: '', handle: null, write: false, at: null, msg: '', busy: false, empty: false, bundle: null, waiting: null };
const listeners = new Set();
export const onFolderChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
const tell = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

function apply(data, name, how) {
  const n = Object.keys(data.esource || {}).length;
  if (!n) throw new Error('No eSource files in "' + name + '". Pick the RAYDAR studies folder (it has a "Pre-screening eSource JSONs" folder inside), or set it up from the study admin.');
  useData(data, 'folder', { name, at: new Date().toISOString(), how });
  FOLDER.at = new Date();
  const probs = (data.problems || []).length;
  FOLDER.msg = n + ' studies read from "' + name + '"' + (probs ? '. ' + probs + ' file(s) couldn\'t be read: ' + data.problems.slice(0, 3).join('; ') : '');
}

async function readHandle(h, write) {
  FOLDER.busy = true; tell();
  try {
    const data = await readFolder(h);
    if (!Object.keys(data.esource).length && write) {
      // an empty folder the study admin can save into: connect it so the admin can fill it; keep the current studies
      Object.assign(FOLDER, { status: 'connected', name: h.name, handle: h, write, empty: true, at: new Date(), msg: 'The folder "' + h.name + '" has no studies yet. Fill it from the study admin (Studies folder page).' });
      return;
    }
    apply(data, h.name, 'folder');
    Object.assign(FOLDER, { status: 'connected', name: h.name, handle: h, write, empty: false });
  } finally { FOLDER.busy = false; tell(); }
}

/* ---- the studies file in _system ---- */
let loadedVersion = null, builtInChosen = false; // true once the person picks 'Use the built-in studies'
export const setLoadedVersion = (v) => { loadedVersion = v; FOLDER.waiting = null; tell(); };
/** Load one of the _system files with a <script> tag (works from file:// with no permission). Its value, or null. */
function loadScript(name, global) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    try { delete window[global]; } catch (e) { window[global] = undefined; }
    const sc = document.createElement('script');
    let done = false;
    const finish = (v) => { if (done) return; done = true; clearTimeout(t); if (sc.parentNode) sc.parentNode.removeChild(sc); resolve(v); };
    const t = setTimeout(() => finish(null), 15000);
    sc.onload = () => finish(window[global] || null);
    sc.onerror = () => finish(null);
    sc.src = SYSTEM_DIR + '/' + name + '?t=' + Date.now();
    document.head.appendChild(sc);
  });
}
const versionOk = (v) => v && typeof v.version === 'string' && v.version.length < 64;
/** Read the studies file in _system. Returns true when RAYDAR is now using it. */
export async function loadBundle() {
  builtInChosen = false;
  const v = await loadScript(BUNDLE_VERSION, 'RAYDAR_STUDIES_VERSION');
  if (!versionOk(v)) return false;
  const b = await loadScript(BUNDLE, 'RAYDAR_STUDIES');
  if (!b || !b.data || !b.data.esource) return false;
  try { apply(b.data, 'the RAYDAR folder', 'file'); } catch (e) { FOLDER.msg = e.message; tell(); return false; }
  loadedVersion = b.version;
  FOLDER.bundle = { version: b.version, by: b.by || '' };
  FOLDER.waiting = null;
  if (FOLDER.status !== 'connected') Object.assign(FOLDER, { status: 'file', name: 'the RAYDAR folder' });
  tell();
  return true;
}

/** On start: the studies file in _system; then the folder picked last time, if Chrome still allows it without a click */
export async function autoConnect() {
  const viaFile = await loadBundle();
  if (!canOpenFolders()) return;
  const h = await savedFolder();
  if (!h) return;
  const p = await permission(h, false, false);
  if (p === 'granted') {
    try { await readHandle(h, (await permission(h, true, false)) === 'granted'); } catch (e) { if (!viaFile) { Object.assign(FOLDER, { status: 'needs-click', name: h.name, handle: h, msg: e.message }); tell(); } }
  } else if (viaFile) {
    FOLDER.handle = h; // kept for the study admin's "Allow saving"; recruiters need nothing more
  } else {
    Object.assign(FOLDER, { status: 'needs-click', name: h.name, handle: h, msg: '' });
    tell();
  }
}

/* ---- noticing a publish while RAYDAR is open ---- */
let checking = false, lastCheck = 0, timer = null;
async function check(isIdle) {
  if (checking || Date.now() - lastCheck < 20000) return;
  checking = true; lastCheck = Date.now();
  try {
    const v = await loadScript(BUNDLE_VERSION, 'RAYDAR_STUDIES_VERSION');
    if (SOURCE.preview || builtInChosen || !versionOk(v) || v.version === loadedVersion) return;
    if (!loadedVersion && FOLDER.status !== 'file' && FOLDER.status !== 'built-in') { loadedVersion = v.version; return; } // read straight from the folder already
    if (isIdle()) await applyUpdate(v.version);
    else if (!FOLDER.waiting || FOLDER.waiting.version !== v.version) { FOLDER.waiting = { version: v.version, by: v.by || '' }; tell(); }
  } finally { checking = false; }
}
/** Use the newer studies now (the call keeps its answers wherever the questions are unchanged) */
export async function applyUpdate(version) {
  const v = version || (FOLDER.waiting && FOLDER.waiting.version);
  if (FOLDER.status === 'connected' && FOLDER.handle) { const r = await reload(); if (r.ok) setLoadedVersion(v); return r.ok; }
  return loadBundle();
}
/** Check now, every few minutes, and whenever the tab is brought back. isIdle(): no call in progress. */
export function startUpdateChecks(isIdle) {
  if (timer || typeof window === 'undefined') return;
  const go = () => { check(isIdle); };
  timer = setInterval(go, 3 * 60 * 1000);
  window.addEventListener('focus', go);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') go(); });
}
/** "25 Nov, 10:42 am" for a version */
export const whenText = (v) => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }); };

/** Pick a folder (first time, or a different one). write: the study admin needs to save into it. */
export async function connect(write) {
  try {
    const h = await pickFolder();
    const ok = await permission(h, !!write, true);
    if (ok !== 'granted') throw new Error('Chrome didn\'t give access to the folder.');
    await readHandle(h, !!write || (await permission(h, true, false)) === 'granted');
    return { ok: true };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, msg: '' };
    FOLDER.msg = e.message; tell();
    return { ok: false, msg: e.message };
  }
}

/** The folder was remembered but needs a click this session */
export async function reconnect(write) {
  if (!FOLDER.handle) return connect(write);
  try {
    const ok = await permission(FOLDER.handle, !!write, true);
    if (ok !== 'granted') throw new Error('Chrome didn\'t give access to the folder.');
    await readHandle(FOLDER.handle, !!write || (await permission(FOLDER.handle, true, false)) === 'granted');
    return { ok: true };
  } catch (e) { FOLDER.msg = e.message; tell(); return { ok: false, msg: e.message }; }
}

/** Read the folder again (after someone published) */
export async function reload() {
  if (FOLDER.handle && FOLDER.status === 'connected') {
    try { await readHandle(FOLDER.handle, FOLDER.write); return { ok: true }; } catch (e) { FOLDER.msg = e.message; tell(); return { ok: false, msg: e.message }; }
  }
  if (FOLDER.status === 'file') return (await loadBundle()) ? { ok: true } : { ok: false, msg: 'Couldn\'t read the studies file in ' + SYSTEM_DIR };
  return { ok: false, msg: 'No folder connected' };
}

/** Browsers without folder access: read a folder picked with a folder input. Read only, for this session. */
export async function usePicked(fileList) {
  try {
    const data = await readPicked(fileList);
    const first = Array.from(fileList || [])[0];
    const name = first && first.webkitRelativePath ? first.webkitRelativePath.split('/')[0] : 'the folder';
    apply(data, name, 'picked');
    Object.assign(FOLDER, { status: 'read-only', name, handle: null, write: false });
    tell();
    return { ok: true };
  } catch (e) { FOLDER.msg = e.message; tell(); return { ok: false, msg: e.message }; }
}

/** Stop using the folder: back to the studies built into this file */
export async function disconnect() {
  await forgetFolder();
  loadedVersion = null; FOLDER.bundle = null; FOLDER.waiting = null; builtInChosen = true;
  useBuiltIn();
  Object.assign(FOLDER, { status: 'built-in', name: '', handle: null, write: false, at: null, msg: 'Using the studies built into this file again' });
  tell();
}

/** One line for the screens */
export function folderLine() {
  if (FOLDER.status === 'connected' && FOLDER.empty) return 'The folder "' + FOLDER.name + '" (empty: fill it from the study admin)';
  if (FOLDER.status === 'connected' || FOLDER.status === 'read-only') return ALL.length + ' studies from the folder "' + FOLDER.name + '"' + (FOLDER.at ? ', read ' + FOLDER.at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '') + (FOLDER.status === 'read-only' ? ' (read only)' : '');
  if (FOLDER.status === 'file') return ALL.length + ' studies from the RAYDAR folder' + (FOLDER.bundle ? ', published ' + whenText(FOLDER.bundle.version) + (FOLDER.bundle.by ? ' by ' + FOLDER.bundle.by : '') : '');
  if (FOLDER.status === 'needs-click') return 'The studies folder "' + FOLDER.name + '" needs a click to reconnect';
  return 'The studies built into this file' + (SOURCE.builtAt ? ' (' + SOURCE.builtAt + ')' : '');
}
export { canOpenFolders };
