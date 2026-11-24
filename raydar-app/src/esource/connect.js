/* RAYDAR 2.8: connecting to the shared studies folder, for the recruiter screens and the study admin alike.
   FOLDER is what the screens show; every change notifies listeners (the store re-renders). */
import { canOpenFolders, pickFolder, savedFolder, forgetFolder, permission, readFolder, readPicked } from './folder.js';
import { useData, useBuiltIn, SOURCE, ALL } from './studies.js';

/** status: 'built-in' (no folder) · 'needs-click' (remembered, Chrome wants a click) · 'connected' · 'read-only' (picked via the fallback) */
export const FOLDER = { status: 'built-in', name: '', handle: null, write: false, at: null, msg: '', busy: false, empty: false };
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

/** On start: reuse the folder picked last time, if Chrome still allows it without a click */
export async function autoConnect() {
  if (!canOpenFolders()) return;
  const h = await savedFolder();
  if (!h) return;
  const p = await permission(h, false, false);
  if (p === 'granted') {
    try { await readHandle(h, (await permission(h, true, false)) === 'granted'); } catch (e) { Object.assign(FOLDER, { status: 'needs-click', name: h.name, handle: h, msg: e.message }); tell(); }
  } else {
    Object.assign(FOLDER, { status: 'needs-click', name: h.name, handle: h, msg: '' });
    tell();
  }
}

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
  useBuiltIn();
  Object.assign(FOLDER, { status: 'built-in', name: '', handle: null, write: false, at: null, msg: 'Using the studies built into this file again' });
  tell();
}

/** One line for the screens */
export function folderLine() {
  if (FOLDER.status === 'connected' && FOLDER.empty) return 'The folder "' + FOLDER.name + '" (empty: fill it from the study admin)';
  if (FOLDER.status === 'connected' || FOLDER.status === 'read-only') return ALL.length + ' studies from the folder "' + FOLDER.name + '"' + (FOLDER.at ? ', read ' + FOLDER.at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '') + (FOLDER.status === 'read-only' ? ' (read only)' : '');
  if (FOLDER.status === 'needs-click') return 'The studies folder "' + FOLDER.name + '" needs a click to reconnect';
  return 'The studies built into this file' + (SOURCE.builtAt ? ' (' + SOURCE.builtAt + ')' : '');
}
export { canOpenFolders };
