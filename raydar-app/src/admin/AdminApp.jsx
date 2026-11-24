/* RAYDAR 2.8 study admin. Opens as its own file (RAYDAR_2.8_Admin.html) or from Tools › Study admin in the
   all-in-one file. Studies are edited as drafts and published into the shared studies folder. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { S, act, subscribe, getVersion, replaceS } from '../engine/store.js';
import App from '../App.jsx';
import { ADMIN_MODE } from './gate.js';
import { previewEvents } from './events.js';
import { W, useWS, notify, say, setName, studyRows, openStudy, createStudy, loadDrafts, discardDraft, setPaused, history, openFromHistory, publishQc, saveSetting, SITES, finishPreview } from './ws.js';
import { FOLDER, connect, reconnect, reload, autoConnect, folderLine, canOpenFolders } from '../esource/connect.js';
import { SETTINGS, SOURCE, builtInData, ALL } from '../esource/studies.js';
import { writeAll, readFolder } from '../esource/folder.js';
import { newStudy, clone } from './ops.js';
import { Editor } from './Editor.jsx';
import { QcPage } from './QcPage.jsx';
import './admin.css';

// The recruiter screens' "Back to the study admin" button ends a preview
if (previewEvents) previewEvents.addEventListener('end', () => { finishPreview(); if (ADMIN_MODE === 'combined') act('admin:open'); });

const Ic = ({ n, style }) => <i className={'ti ' + n} style={style} aria-hidden="true" />;

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminApp({ embedded, onExit }) {
  useWS();
  useSyncExternalStore(subscribe, getVersion);
  useEffect(() => { if (!embedded) document.title = 'RAYDAR 2.8 Study admin'; (async () => { if (FOLDER.status === 'built-in') await autoConnect(); await loadDrafts(); })(); }, []);
  // keyboard: Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z undo and redo in the builder
  useEffect(() => {
    const k = (e) => {
      if (W.previewing || W.view !== 'study' || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault(); import('./ws.js').then((m) => (e.shiftKey ? m.redo() : m.undo()));
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  if (W.previewing) return ADMIN_MODE === 'admin' ? <App /> : null;
  const body = <Shell embedded={embedded} onExit={onExit} />;
  return embedded ? body : <div id="rd" className={S.dark ? 'dk' : ''} style={{ fontSize: S.fs, minHeight: '100vh' }}>{body}</div>;
}

function Shell({ embedded, onExit }) {
  const pinNeeded = ADMIN_MODE === 'combined' && SETTINGS.adminPin && !W.unlocked;
  return (
    <div className="ad">
      <header className="ad-top">
        <span className="ad-brand">RAYDAR <span>2.8</span></span>
        <span className="ad-badge">STUDY ADMIN</span>
        <span className="ad-sub">Changes reach recruiters only when you publish</span>
        <span style={{ flex: 1 }} />
        <NameBox />
        <button className="ad-btn ghost" onClick={() => act('theme')} aria-label={S.dark ? 'Light mode' : 'Dark mode'}><Ic n={S.dark ? 'ti-sun' : 'ti-moon'} /></button>
        {embedded ? <button className="ad-btn" onClick={onExit}><Ic n="ti-arrow-back-up" /> Back to calls</button> : null}
      </header>
      {pinNeeded ? <PinGate /> : (
        <div className="ad-body">
          <nav className="ad-nav" aria-label="Admin sections">
            {[['studies', 'Studies', 'ti-list-details'], ['qc', 'Quick check settings', 'ti-filter'], ['history', 'Change history', 'ti-history'], ['folder', 'Studies folder', 'ti-folder']].map(([k, l, i]) => (
              <button key={k} className={'ad-navi' + (W.view === k || (k === 'studies' && W.view === 'study') ? ' on' : '')} onClick={() => { W.view = k; W.msg = null; notify(); }}><Ic n={i} /> {l}</button>
            ))}
            <div className="ad-navnote">
              <b>Where studies live</b>
              {folderLine()}
              {FOLDER.status === 'connected' && !FOLDER.write ? <><br /><button className="ad-link" onClick={() => reconnect(true).then(loadDrafts)}>Allow saving to it</button></> : null}
              {FOLDER.status === 'needs-click' ? <><br /><button className="ad-link" onClick={() => reconnect(true).then(loadDrafts)}>Reconnect</button></> : null}
            </div>
          </nav>
          <main className="ad-main">
            {W.msg ? <div className={'ad-msg ' + W.msg.kind} role="status"><span style={{ flex: 1 }}>{W.msg.text}</span><button className="ad-x" onClick={() => say('')} aria-label="Dismiss"><Ic n="ti-x" /></button></div> : null}
            {W.view === 'studies' ? <Studies /> : W.view === 'study' ? <Editor /> : W.view === 'qc' ? <QcPage /> : W.view === 'history' ? <History /> : <FolderPage />}
          </main>
        </div>
      )}
      {W.dialog ? <Dialog /> : null}
    </div>
  );
}

function NameBox() {
  const [v, setV] = useState(W.name);
  if (W.name) return <span className="ad-sub">Signed in as <b>{W.name}</b> <button className="ad-link" onClick={() => setName('')}>change</button></span>;
  return (
    <form className="ad-namebox" onSubmit={(e) => { e.preventDefault(); setName(v); }}>
      <label>Your name <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Recorded with each publish" /></label>
      <button className="ad-btn pri" disabled={!v.trim()}>Save</button>
    </form>
  );
}

function PinGate() {
  const [v, setV] = useState(''), [err, setErr] = useState('');
  return (
    <form className="ad-card ad-pin" onSubmit={async (e) => { e.preventDefault(); if ((await sha(v)) === SETTINGS.adminPin) { W.unlocked = true; notify(); } else setErr('That PIN isn\'t right.'); }}>
      <h2>Study admin PIN</h2>
      <p className="ad-mut">This all-in-one RAYDAR asks for the admin PIN set in the studies folder. It keeps the admin out of the way of recruiters; it isn't real security (the two-file setup is).</p>
      <label className="ad-field">PIN <input type="password" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></label>
      {err ? <p className="ad-err">{err}</p> : null}
      <button className="ad-btn pri">Open the study admin</button>
    </form>
  );
}

/* ---------------- studies list ---------------- */
function Studies() {
  const [q, setQ] = useState(''), [show, setShow] = useState('all'), [city, setCity] = useState('all');
  const imp = useRef(null);
  const rows = studyRows().filter((r) => {
    const t = (r.s.code + ' ' + r.s.site + ' ' + (r.s.d || '')).toLowerCase();
    if (q && !t.includes(q.toLowerCase())) return false;
    if (show === 'live' && (!r.live || r.paused)) return false;
    if (show === 'drafts' && !r.draft) return false;
    if (show === 'paused' && !r.paused) return false;
    if (city !== 'all' && (/sydney/i.test(r.s.site) ? 'sydney' : 'melbourne') !== city) return false;
    return true;
  });
  const onImport = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    let j; try { j = JSON.parse(await f.text()); } catch (err) { return say(f.name + ' isn\'t valid JSON. Export it again from the eSource tool.', 'warn'); }
    if (!j || !Array.isArray(j.pages)) return say(f.name + ' isn\'t an eSource form (no pages).', 'warn');
    const m = /^(Emeritus Melbourne|Emeritus Sydney|Veritus) - (.+) - pre-screening\.json$/i.exec(f.name);
    if (m && ALL.find((s) => s.file === f.name)) { W.drafts[f.name] = { ...(W.drafts[f.name] || (await import('./ws.js')).liveBundle(f.name)), esource: j }; openStudy(f.name, 'publish'); say('Loaded ' + f.name + ' as a draft of the live study. "What changes" below shows the differences.'); return; }
    W.dialog = { kind: 'new', esource: j, site: m ? SITES.find((x) => x.toLowerCase() === m[1].toLowerCase()) : SITES[0], code: m ? m[2] : (j.title || '').split(/\s+/)[0] || '', title: (j.title || '').replace(/\s*pre-?screening.*$/i, '') };
    notify();
  };
  return (
    <div className="ad-page">
      <div className="ad-row">
        <h1>Studies</h1>
        <span style={{ flex: 1 }} />
        <button className="ad-btn" onClick={() => imp.current && imp.current.click()}><Ic n="ti-file-import" /> Import an eSource file</button>
        <button className="ad-btn pri" onClick={() => { W.dialog = { kind: 'new', site: SITES[0], code: '', title: '' }; notify(); }}><Ic n="ti-plus" /> New study</button>
        <input ref={imp} type="file" accept=".json,application/json" hidden onChange={onImport} />
      </div>
      <div className="ad-row">
        <input type="search" className="ad-search" placeholder="Search by code, name or site" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search studies" />
        <Seg val={show} set={setShow} opts={[['all', 'All'], ['live', 'Live'], ['drafts', 'Drafts'], ['paused', 'Paused']]} />
        <Seg val={city} set={setCity} opts={[['all', 'All sites'], ['melbourne', 'Melbourne'], ['sydney', 'Sydney']]} />
      </div>
      <div className="ad-table" role="table">
        <div className="ad-tr ad-th" role="row"><span>Study</span><span>Site</span><span>Status</span><span>Quick check (read from its questions)</span><span>Dates</span><span /></div>
        {rows.map((r) => <StudyRow key={r.file} r={r} />)}
        {!rows.length ? <p className="ad-mut" style={{ padding: 14 }}>No studies match.</p> : null}
      </div>
      <p className="ad-mut ad-small">Every row opens the same editor, whether the study came from an eSource file or was built here. Drafts are saved {FOLDER.write ? 'in the studies folder (_drafts), so other admins see them' : 'in this browser until a studies folder is connected'}.</p>
    </div>
  );
}
function StudyRow({ r }) {
  const s = r.s;
  const rules = (s.qc || []).filter((x) => x.result === 'no').map((x) => x.why).concat((s.qc || []).filter((x) => x.result === 'check').map((x) => x.why));
  const dates = s.sched ? 'Rolling, from screening date' : s.cohorts && s.cohorts.length ? s.cohorts.length + ' cohort' + (s.cohorts.length > 1 ? 's' : '') + ', next ' + (s.cohorts.find((c) => !c.closed) || s.cohorts[0]).in : r.live ? 'No dates' : 'Not set';
  const fix = (s.issues || []).filter((i) => /never shows|can't be read|no such answer/.test(i.msg)).length;
  return (
    <div className={'ad-tr' + (r.draft ? ' draft' : '')} role="row">
      <span className="mono">{s.code}</span>
      <span>{s.site === 'Veritus' ? 'Veritus Melbourne' : s.site}</span>
      <span>{r.paused ? <span className="ad-tag warn">Paused</span> : r.live ? <span className="ad-tag ok">Live</span> : null} {r.draft ? <span className="ad-tag dash">{r.live ? 'Draft changes' : 'Draft'}</span> : null} {fix ? <span className="ad-tag warn" title="The file check found questions that never show">{fix} to fix</span> : null}</span>
      <span className="ad-rules">{rules.length ? rules.slice(0, 3).join(' · ') : <span className="ad-mut">{r.live ? 'No condition rules' : 'Not checked yet'}</span>}</span>
      <span>{dates}</span>
      <span className="ad-acts">
        <button className="ad-btn sm" onClick={() => openStudy(r.file)}>{r.draft ? 'Keep editing' : 'Open'}</button>
        {r.live ? <button className="ad-btn sm ghost" title={r.paused ? 'Show it to recruiters again' : 'Hide it from recruiters (no longer recruiting)'} onClick={() => setPaused(r.file, !r.paused)}>{r.paused ? 'Resume' : 'Pause'}</button> : null}
        <button className="ad-btn sm ghost" title="Copy this study to another site" onClick={() => { W.dialog = { kind: 'copy', file: r.file, site: SITES.find((x) => x !== s.site) }; notify(); }}><Ic n="ti-copy" /></button>
        {r.draft ? <button className="ad-btn sm ghost" title="Throw away the draft" onClick={() => { if (window.confirm('Throw away the unpublished changes to ' + s.code + '?')) discardDraft(r.file); }}><Ic n="ti-trash" /></button> : null}
      </span>
    </div>
  );
}
export function Seg({ val, set, opts, label }) {
  return (
    <span className="ad-seg" role="radiogroup" aria-label={label}>
      {opts.map(([k, l]) => <button key={String(k)} role="radio" aria-checked={val === k} className={val === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}
    </span>
  );
}

/* ---------------- dialogs ---------------- */
function Dialog() {
  const d = W.dialog;
  const [site, setSite] = useState(d.site), [code, setCode] = useState(d.code || ''), [title, setTitle] = useState(d.title || ''), [withDates, setWD] = useState(true);
  const close = () => { W.dialog = null; notify(); };
  if (d.kind === 'copy') {
    return (
      <div className="ad-modal" role="dialog" aria-modal="true" aria-label="Copy to another site"><div className="ad-card">
        <h2>Copy {d.file.replace(/ - pre-screening\.json$/, '')} to another site</h2>
        <label className="ad-field">Site <select value={site} onChange={(e) => setSite(e.target.value)}>{SITES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="ad-check"><input type="checkbox" checked={withDates} onChange={(e) => setWD(e.target.checked)} /> Copy its cohort dates too (check them: sites often differ)</label>
        <div className="ad-row end"><button className="ad-btn ghost" onClick={close}>Cancel</button><button className="ad-btn pri" onClick={async () => { close(); (await import('./ws.js')).copyStudy(d.file, site, withDates); }}>Copy as a draft</button></div>
      </div></div>
    );
  }
  const okCode = /^[A-Za-z0-9][A-Za-z0-9 ()._-]{1,40}$/.test(code.trim());
  return (
    <div className="ad-modal" role="dialog" aria-modal="true" aria-label="New study"><div className="ad-card">
      <h2>{d.esource ? 'Import ' + (d.esource.title || 'an eSource file') : 'New study'}</h2>
      <p className="ad-mut">{d.esource ? 'Its questions come in as TST wrote them. Choose the site and the code recruiters use for it.' : 'Starts with Study Notes and Demographics (sex, date of birth, BMI). Drag in the rest.'}</p>
      <label className="ad-field">Site <select value={site} onChange={(e) => setSite(e.target.value)}>{SITES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="ad-field">Study code <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="The short code recruiters say, e.g. SRSD" autoFocus /></label>
      {!d.esource ? <label className="ad-field">Protocol number or name <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SRSD384-101" /></label> : null}
      <p className="ad-mut ad-small">File: {code.trim() ? site + ' - ' + code.trim() + ' - pre-screening.json' : '…'}</p>
      <div className="ad-row end"><button className="ad-btn ghost" onClick={close}>Cancel</button>
        <button className="ad-btn pri" disabled={!okCode} onClick={() => { close(); createStudy(site, code.trim(), title.trim(), d.esource ? clone(d.esource) : newStudy(code.trim(), title.trim() || code.trim())); }}>Create the draft</button></div>
    </div></div>
  );
}

/* ---------------- history ---------------- */
function History() {
  const [file, setFile] = useState(ALL[0] ? ALL[0].file : ''), [list, setList] = useState(null);
  useEffect(() => { setList(null); history(file).then(setList); }, [file, FOLDER.at]);
  return (
    <div className="ad-page">
      <h1>Change history</h1>
      <p className="ad-mut">Every publish keeps a copy in the studies folder (_history), with who published it and who checked it. Open an old version as a draft and publish it to roll back.</p>
      {FOLDER.status !== 'connected' ? <p className="ad-msg warn">Connect the studies folder to see its history.</p> : null}
      <label className="ad-field" style={{ maxWidth: 520 }}>Study <select value={file} onChange={(e) => setFile(e.target.value)}>{ALL.map((s) => <option key={s.file} value={s.file}>{s.c} · {s.siteLabel}</option>)}</select></label>
      <div className="ad-table">
        {list === null ? <p className="ad-mut" style={{ padding: 12 }}>Reading…</p> : !list.length ? <p className="ad-mut" style={{ padding: 12 }}>Nothing published from the study admin yet.</p> : list.map((n) => (
          <div key={n} className="ad-tr two"><span>{n.replace(/\.json$/, '')}</span><span className="ad-acts"><button className="ad-btn sm" onClick={() => openFromHistory(file, n)}>Open as a draft</button></span></div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- studies folder ---------------- */
function FolderPage() {
  const [busy, setBusy] = useState(''), [pin, setPin] = useState('');
  const empty = FOLDER.status === 'connected' && FOLDER.empty;
  const setUp = async () => {
    if (!FOLDER.handle) return;
    const existing = await readFolder(FOLDER.handle);
    if (Object.keys(existing.esource).length && !window.confirm('This folder already has ' + Object.keys(existing.esource).length + ' eSource files. Overwrite them with the studies built into this RAYDAR?')) return;
    setBusy('Writing ' + Object.keys(builtInData().esource).length + ' studies…');
    try { await writeAll(FOLDER.handle, builtInData()); await reload(); say('The folder is set up with the studies built into this RAYDAR. Recruiters can connect to it now.'); } catch (e) { say('Couldn\'t write to the folder: ' + e.message, 'warn'); }
    setBusy('');
  };
  return (
    <div className="ad-page">
      <h1>Studies folder</h1>
      <p>RAYDAR and the study admin share one folder in Dropbox. The admin publishes into it; recruiters' RAYDAR reads it each time it opens. Inside it: <span className="mono">Pre-screening eSource JSONs/</span>, the four RAYDAR settings files, <span className="mono">_drafts/</span> and <span className="mono">_history/</span>: the same layout as the repo, so the Claude study skills work on it too.</p>
      <div className="ad-card">
        <p><b>Now using:</b> {folderLine()}{FOLDER.status === 'connected' ? (FOLDER.write ? ' · you can publish into it' : ' · read only for now') : ''}</p>
        <div className="ad-row">
          {canOpenFolders() ? <button className="ad-btn pri" onClick={() => connect(true).then(loadDrafts)}><Ic n="ti-folder-open" /> {FOLDER.status === 'built-in' ? 'Connect the studies folder' : 'Pick a different folder'}</button> : <p className="ad-msg warn">This browser can't save into a folder. Use Chrome or Edge for the study admin.</p>}
          {FOLDER.status === 'connected' && !FOLDER.write ? <button className="ad-btn" onClick={() => reconnect(true).then(loadDrafts)}>Allow saving to it</button> : null}
          {FOLDER.status === 'connected' ? <button className="ad-btn" onClick={() => reload().then(loadDrafts)}><Ic n="ti-refresh" /> Read it again</button> : null}
        </div>
        {FOLDER.msg ? <p className="ad-mut ad-small">{FOLDER.msg}</p> : null}
      </div>
      <div className="ad-card">
        <h2>Set up a new folder</h2>
        <p className="ad-mut">Make an empty folder in Dropbox (for example "RAYDAR studies"), share it with the recruiters as view-only and with admins as editors, connect it above, then fill it with the studies built into this RAYDAR.</p>
        <button className="ad-btn" disabled={!FOLDER.write || !!busy} onClick={setUp}>{busy || 'Fill the folder with the built-in studies'}</button>
        {empty ? <p className="ad-msg warn">The connected folder has no studies yet.</p> : null}
      </div>
      {ADMIN_MODE === 'combined' ? (
        <div className="ad-card">
          <h2>Admin PIN for the all-in-one file</h2>
          <p className="ad-mut">Asks for a PIN before the study admin opens from Tools. Anyone with the file could get round it, so it only keeps the admin out of recruiters' way.</p>
          <div className="ad-row"><input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={SETTINGS.adminPin ? 'A PIN is set. Type a new one' : 'Choose a PIN'} aria-label="Admin PIN" />
            <button className="ad-btn" disabled={pin.length < 4} onClick={async () => { await saveSetting('adminPin', await sha(pin)); setPin(''); say('PIN saved.'); }}>Save PIN</button>
            {SETTINGS.adminPin ? <button className="ad-btn ghost" onClick={async () => { await saveSetting('adminPin', ''); say('PIN removed.'); }}>Remove the PIN</button> : null}
          </div>
        </div>
      ) : null}
      <p className="ad-mut ad-small">Built into this file: {Object.keys(builtInData().esource).length} studies{SOURCE.builtAt ? ', ' + SOURCE.builtAt : ''}.</p>
    </div>
  );
}
export { QcPage, replaceS };
