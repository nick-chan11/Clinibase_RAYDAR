import { useEffect, useRef } from 'react';
import { S, act, EMRE, srcQ, upd } from '../engine/store.js';
import { Expander } from '../motion/components.jsx';

/** Click handler for an engine action, e.g. <button {...A('confirm')}> */
export const A = (a) => ({
  onClick: (e) => {
    e.preventDefault();
    if (a === 'theme') {
      // Theme switch: no colour transitions for the frame the theme flips, so colours don't fade at different speeds
      const root = document.documentElement;
      root.classList.add('theme-switching');
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    }
    act(a);
  },
});

export const Ic = ({ n, style, label }) => (
  <i className={'ti ' + n} style={style} aria-hidden={label ? undefined : 'true'} aria-label={label} />
);
export const B = ({ children, style }) => <b style={{ fontWeight: 500, ...style }}>{children}</b>;

/** Bold numbers and colour key phrases (doctor check, excluded, allowed) in study text. */
export function Emph({ t, nums }) {
  const out = [];
  let last = 0, i = 0;
  const re = new RegExp(EMRE.source, EMRE.flags);
  for (const m of String(t).matchAll(re)) {
    const [s, a, b, , d] = m;
    if (m.index > last) out.push(String(t).slice(last, m.index));
    if (d) out.push(<B key={i++}>{s}</B>);
    else if (nums) out.push(s);
    else out.push(<B key={i++} style={{ color: 'var(--text-' + (a ? 'warning' : b ? 'danger' : 'success') + ')' }}>{s}</B>);
    last = m.index + s.length;
  }
  if (last < String(t).length) out.push(String(t).slice(last));
  return <>{out}</>;
}

/** Highlight the question-search term. */
export function Hl({ t }) {
  const term = S.qs.trim();
  if (!term) return <>{t}</>;
  const parts = String(t).split(new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? <mark key={i} style={{ background: 'var(--bg-warning)', color: 'var(--text-warning)', borderRadius: 2, padding: '0 1px' }}>{p}</mark> : p
      )}
    </>
  );
}

export function Seg({ k, opts, cur }) {
  return (
    <div className="seg">
      {opts.map((o) => (
        <button key={o[0]} {...A('set:' + k + ':' + o[0])} className={cur === o[0] ? o[2] || 'sel' : ''} aria-pressed={cur === o[0]}>
          {o[1]}
        </button>
      ))}
    </div>
  );
}

export function Badge({ p }) {
  if (!p) return <span className="mut" style={{ fontSize: 11 }}>Not on the list</span>;
  const c = p.o === 'x' ? 'bad' : p.o === 'd' ? 'warn' : 'ok', l = p.o === 'x' ? 'Prohibited' : p.o === 'd' ? 'Doctor check' : 'Allowed';
  return (
    <>
      <span className={'pill bdg ' + c}>{l}</span> <span className="mut" style={{ fontSize: 11 }}>{p.n} · {p.w}</span>
    </>
  );
}

export function FuHint({ q }) {
  const F = srcQ().filter((z) => z.when && z.when.id === q.id);
  if (!F.length) return null;
  const labs = [...new Set(F.flatMap((z) => z.when.is))];
  return (
    <p style={{ fontSize: 11, margin: '6px 0 0', color: 'var(--text-accent)' }}>
      <Ic n="ti-corner-down-right" /> Answering{' '}
      {labs.map((l, i) => <span key={l}>{i ? ' or ' : ''}<B>{l}</B></span>)} opens a follow-up question
    </p>
  );
}

/** A body the person can resize by dragging its corner; the height is remembered per panel. */
export function Resizable({ id, children, style, className = '', ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (ref.current?.style.height) S.sz[id] = ref.current.style.height; });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [id]);
  return (
    <div ref={ref} className={'rs ' + className} style={{ ...(S.sz[id] ? { height: S.sz[id] } : null), ...style }} {...rest}>
      {children}
    </div>
  );
}

const Chev = ({ shut }) => <i className={'ti ti-chevron-down chev' + (shut ? ' shut' : '')} aria-hidden="true" />;

export function PanelHead({ id, title, sub, right }) {
  const c = S.col[id];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button className="pill ib" {...A('col:' + id)} aria-expanded={!c} aria-label={(c ? 'Expand ' : 'Collapse ') + (typeof title === 'string' ? title : '')} style={{ padding: '0 2px' }}>
        <Chev shut={c} />
      </button>
      <button className="lnk" {...A('col:' + id)} style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, textAlign: 'left' }}>{title}</button>
      {sub ? <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</span> : null}
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

/** A collapsible card. Collapsing uses the expander, so the panels below glide instead of jumping. */
export function Panel({ id, title, sub, right, children, rs, style }) {
  const c = !!S.col[id];
  return (
    <div className="card" style={{ padding: '10px 12px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="pill ib" {...A('col:' + id)} aria-expanded={!c} aria-label={c ? 'Expand' : 'Collapse'} style={{ padding: '0 2px' }}>
          <Chev shut={c} />
        </button>
        <button className="lnk" {...A('col:' + id)} style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 15, fontWeight: 500, textAlign: 'left' }}>{title}</button>
        {sub ? <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>{sub}</span> : null}
        <span style={{ flex: 1 }} />
        {right}
      </div>
      <Expander open={!c}>
        {rs ? <Resizable id={id} style={{ marginTop: 6 }}>{children}</Resizable> : <div style={{ marginTop: 6 }}>{children}</div>}
      </Expander>
    </div>
  );
}

/** Text input bound to the store. */
export function Field({ get, set, ...rest }) {
  return <input type="text" value={get() ?? ''} onChange={(e) => upd(() => set(e.target.value))} {...rest} />;
}
