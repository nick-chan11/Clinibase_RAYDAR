import { useEffect, useRef, useState } from 'react';
import { S, upd, age, drCode, drText } from '../engine/store.js';
import { ST } from '../engine/data.js';
import { A, Ic, Panel } from './ui.jsx';
import { IconSwap } from '../motion/components.jsx';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Async button (skill recipe): disables on press, keeps its width (label, spinner and check share one cell),
 * shows the spinner only after 300ms and holds it at least 500ms, then swaps to a check.
 * Failure swaps back to the label and puts the message beside the button.
 */
function CopyButton({ getText }) {
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  async function run() {
    if (state === 'pending') return;
    setMsg('');
    let shownAt = 0;
    const t = setTimeout(() => { if (alive.current) { setState('pending'); shownAt = performance.now(); } }, 300);
    const hold = () => (shownAt ? wait(Math.max(0, 500 - (performance.now() - shownAt))) : null);
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(getText());
      clearTimeout(t); await hold();
      if (!alive.current) return;
      setState('success'); setMsg('Copied');
      await wait(1800);
      if (alive.current) { setState('idle'); setMsg(''); }
    } catch {
      clearTimeout(t); await hold();
      if (!alive.current) return;
      setState('idle'); setMsg('Copy is blocked here. Select the text and copy it');
    }
  }
  return (
    <>
      <span className="mut" style={{ fontSize: 12 }} aria-live="polite">{msg || S.copied}</span>
      <button className="pill abtn" onClick={run} disabled={state === 'pending'} aria-busy={state === 'pending'}>
        <span aria-hidden={state !== 'idle'} style={{ opacity: state === 'idle' ? 1 : 0, transition: 'opacity 150ms var(--ease-out)' }}>
          <Ic n="ti-copy" /> Copy text
        </span>
        <span aria-hidden={state !== 'pending'} style={{ opacity: state === 'pending' ? 1 : 0, transition: 'opacity 150ms var(--ease-out)' }}>
          <span className="spin" />
        </span>
        <span aria-hidden={state !== 'success'} style={{ opacity: state === 'success' ? 1 : 0, transition: 'opacity 150ms var(--ease-out)', color: 'var(--text-success)' }}>
          <IconSwap k={state === 'success' ? 'y' : 'n'}>{state === 'success' ? <Ic n="ti-check" /> : <span />}</IconSwap> Copied
        </span>
      </button>
    </>
  );
}

export function DrPanel() {
  const a = age(), sx = S.sex ? (S.sex === 'f' ? 'F' : 'M') : '?', ed = S.dre.txt != null, txt = ed ? S.dre.txt : drText();
  return (
    <Panel
      id="dre"
      title={<><Ic n="ti-stethoscope" style={{ color: 'var(--text-warning)' }} /> Create Dr enquiry</>}
      right={S.col.dre ? null : <button className="pill ib" {...A('dre:close')} aria-label="Close"><Ic n="ti-x" /></button>}
      style={{ marginBottom: 10, border: '1.5px solid var(--border-warning)' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
        <label>
          <span className="fl">Study being queried</span>
          <select value={drCode()} onChange={(e) => upd(() => (S.dre.study = e.target.value))} style={{ width: '100%', height: 30, fontSize: 12 }}>
            {ST.map((x) => <option key={x.c}>{x.c}</option>)}
          </select>
        </label>
        <div>
          <span className="fl">Age and sex (from Quick Check)</span>
          <div className="soft" style={{ padding: '5px 10px', fontWeight: 500 }}>{a != null ? a : '?'}{sx}</div>
        </div>
        <label style={{ gridColumn: 'span 2' }}>
          <span className="fl">Participant link (paste from CTMS)</span>
          <input type="url" inputMode="url" placeholder="https://" value={S.dre.url} onChange={(e) => upd(() => (S.dre.url = e.target.value.trim()))} />
        </label>
        <label style={{ gridColumn: 'span 2' }}>
          <span className="fl">Concern</span>
          <textarea placeholder="What should the doctor check? One point per line" style={{ width: '100%', minHeight: 48, fontSize: 12, boxSizing: 'border-box' }}
            value={S.dre.concern} onChange={(e) => upd(() => (S.dre.concern = e.target.value))} />
        </label>
      </div>
      <button className="pill ib" {...A('dre:flags')} style={{ color: 'var(--text-accent)', paddingLeft: 0, marginTop: 2 }}>
        <Ic n="ti-plus" /> Add flagged and doctor-check items to concern
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          Enquiry text{' '}
          <span style={{ fontSize: 11, fontWeight: 400, fontStyle: 'italic', color: 'var(--text-' + (ed ? 'warning' : 'secondary') + ')' }}>
            {ed ? 'edited by you, no longer updates automatically' : 'updates as you log items. Click into it to edit'}
          </span>
        </span>
        {ed ? <button className="lnk" {...A('dre:regen')} style={{ fontSize: 12 }}>Rebuild from the list</button> : null}
      </div>
      <textarea id="dreTxt" spellCheck={false} aria-label="Enquiry text" value={txt} onChange={(e) => upd(() => (S.dre.txt = e.target.value))}
        style={{ width: '100%', minHeight: 220, marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5, padding: 10, boxSizing: 'border-box', background: 'var(--surface-1)', border: '.5px solid var(--border-strong)', borderRadius: 'var(--radius)', resize: 'vertical' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <CopyButton getText={() => (S.dre.txt != null ? S.dre.txt : drText())} />
        <button className="pill pri" {...A('dre:send')}>Send to chat ↗</button>
      </div>
    </Panel>
  );
}
