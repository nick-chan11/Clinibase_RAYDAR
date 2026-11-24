import { useRef, useState } from 'react';
import { S, upd, act } from '../engine/store.js';
import { FOLDER, connect, reconnect, reload, disconnect, usePicked, folderLine, canOpenFolders } from '../esource/connect.js';
import { SETTINGS } from '../esource/studies.js';
import { A, Ic, B } from './ui.jsx';

/** Tools › Studies folder (2.8): where RAYDAR's studies come from, and connecting the shared Dropbox folder. */
export function FolderTool() {
  const pick = useRef(null);
  const [msg, setMsg] = useState('');
  const run = async (p) => { setMsg(''); const r = await p; if (r && r.msg) setMsg(r.msg); upd(() => {}); };
  const st = FOLDER.status;
  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 500, fontSize: 15 }}>Studies folder</span>
        <button className="pill ib" {...A('close')} aria-label="Close"><Ic n="ti-x" /></button>
      </div>
      <p style={{ fontSize: 13, margin: '0 0 6px' }}><B>Using:</B> {folderLine()}</p>
      <p className="mut" style={{ fontSize: 12, margin: '0 0 10px' }}>
        The study admin publishes studies into a shared Dropbox folder. Connect that folder and RAYDAR reads the latest studies each time it opens, so a new or changed study needs no new RAYDAR file. Ask your team lead which folder.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {st === 'needs-click' ? <button className="pill pri" onClick={() => run(reconnect(false))}><Ic n="ti-plug-connected" /> Reconnect "{FOLDER.name}"</button> : null}
        {canOpenFolders() ? <button className={'pill' + (st === 'built-in' ? ' pri' : '')} onClick={() => run(connect(false))} disabled={FOLDER.busy}><Ic n="ti-folder-open" /> {st === 'built-in' ? 'Connect the studies folder' : 'Pick a different folder'}</button> : null}
        {st === 'connected' ? <button className="pill" onClick={() => run(reload())} disabled={FOLDER.busy}><Ic n="ti-refresh" /> Read it again</button> : null}
        {!canOpenFolders() ? <button className="pill pri" onClick={() => pick.current && pick.current.click()}><Ic n="ti-folder-open" /> Choose the studies folder</button> : null}
        {st !== 'built-in' ? <button className="pill" onClick={() => run(disconnect())}>Use the built-in studies</button> : null}
      </div>
      <input ref={pick} type="file" webkitdirectory="" directory="" multiple hidden onChange={(e) => { const f = e.target.files; e.target.value = ''; run(usePicked(f)); }} />
      {FOLDER.busy ? <p className="mut" style={{ fontSize: 12 }}>Reading the folder…</p> : null}
      {msg || FOLDER.msg ? <p role="status" style={{ fontSize: 12, margin: '8px 0 0' }}>{msg || FOLDER.msg}</p> : null}
      {!canOpenFolders() ? <p className="mut" style={{ fontSize: 11, margin: '8px 0 0' }}>This browser can read a folder but not remember it, so choose it each time. Chrome remembers it.</p> : null}
    </div>
  );
}

const SEEN = 'raydar.news.seen';
function seen() { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch (e) { return []; } }
function markSeen(id) { try { localStorage.setItem(SEEN, JSON.stringify(seen().concat(id).slice(-200))); } catch (e) { /* shows again next time */ } }

/** Above the call: the folder needs a click, or a note the study admin left with a publish (shown once). */
export function FolderBanner() {
  const [, force] = useState(0);
  const news = (SETTINGS.news || []).filter((n) => n && n.id && !seen().includes(n.id)).slice(-3).reverse();
  if (FOLDER.status !== 'needs-click' && !news.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      {FOLDER.status === 'needs-click' ? (
        <div className="card" role="status" style={{ padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', borderLeft: '3px solid var(--border-warning)' }}>
          <Ic n="ti-folder" style={{ color: 'var(--text-warning)' }} />
          <span style={{ fontSize: 13, flex: 1 }}>Chrome needs one click to read the studies folder "{FOLDER.name}" again. Until then RAYDAR uses the studies built into this file.</span>
          <button className="pill pri" onClick={async () => { await reconnect(false); upd(() => {}); }}>Reconnect</button>
        </div>
      ) : null}
      {news.map((n) => (
        <div key={n.id} className="card" role="status" style={{ padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', borderLeft: '3px solid var(--border-accent)' }}>
          <Ic n="ti-speakerphone" style={{ color: 'var(--text-accent)' }} />
          <span style={{ fontSize: 13, flex: 1 }}><B>Study update{n.at ? ' · ' + new Date(n.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}:</B> {n.text}</span>
          <button className="pill ib" aria-label="Dismiss" onClick={() => { markSeen(n.id); force((x) => x + 1); }}><Ic n="ti-x" /></button>
        </div>
      ))}
    </div>
  );
}
export { act };
