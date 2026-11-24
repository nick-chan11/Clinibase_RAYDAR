import { useRef, useState } from 'react';
import { S, upd } from '../engine/store.js';
import { importCallback } from '../pdf/report.js';
import { Ic, A } from './ui.jsx';

/** "Import callback": pick a RAYDAR PDF (or its CSV) and carry on that call. */
export function ImportButton({ label, className, style }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    setBusy(true);
    let r;
    try { r = await importCallback(f); } catch (e) { r = { ok: false, msg: 'This file couldn\'t be read: ' + (e && e.message ? e.message : e) }; }
    setBusy(false);
    upd(() => { S.impMsg = r; S.tool = null; });
  };
  return (
    <>
      <button type="button" className={className || 'pill'} style={style} disabled={busy} onClick={() => {
        const busyCall = S.pid || Object.keys(S.out).length || S.log.length;
        if (busyCall && !window.confirm('Reopening a callback replaces the call on screen. Save its PDF first if you need it. Carry on?')) return;
        if (ref.current) ref.current.click();
      }}>
        <Ic n="ti-file-import" /> {busy ? 'Reading the file…' : label || 'Import callback'}
      </button>
      <input ref={ref} type="file" accept=".pdf,.csv,application/pdf,text/csv" hidden aria-hidden="true" tabIndex={-1} onChange={onFile} />
    </>
  );
}

/** What came back from the file, shown above the identity check. */
export function ImportNote() {
  const m = S.impMsg, r = S.resumed;
  if (!m && !r) return null;
  const ok = m ? m.ok : true;
  return (
    <div className="card" role="status" style={{ borderLeft: '3px solid var(--border-' + (ok ? 'accent' : 'warning') + ')', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 13 }}>
          <b style={{ fontWeight: 600 }}>{ok ? 'Callback reopened' + (S.pid ? ' for ' + S.pid : '') : 'Couldn\'t reopen this callback'}</b>
          {r ? <div className="mut" style={{ fontSize: 12, marginTop: 2 }}>{r.file}{r.at ? ' · saved ' + new Date(r.at).toLocaleString('en-AU') : ''}{r.reason ? ' · ' + r.reason : ''}</div> : null}
          {m ? <p style={{ margin: '6px 0 0' }}>{m.msg}</p> : null}
          {r && r.changed.length ? <p className="mut" style={{ margin: '4px 0 0', fontSize: 12 }}>Ask again: {r.changed.slice(0, 8).join('; ')}{r.changed.length > 8 ? ' …' : ''}</p> : null}
        </div>
        {m ? <button className="pill ib" {...A('impclose')} aria-label="Dismiss"><Ic n="ti-x" /></button> : null}
      </div>
    </div>
  );
}
