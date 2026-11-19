import { memo, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { S, act, commit, curQ, getVersion, subscribe, upd } from './engine/store.js';
import { Expander, shake } from './motion/components.jsx';
import { STAGE, STAGE_EXIT, prefersReduced } from './motion/tokens.js';
import { Header, Steps, Guide } from './views/Header.jsx';
import { Identity, QuickCheck } from './views/Intake.jsx';
import { PreScreen } from './views/PreScreen.jsx';
import { Finish } from './views/Finish.jsx';
import { Planner } from './views/Planner.jsx';
import { DrPanel } from './views/DrPanel.jsx';
import { Drawer } from './views/Drawer.jsx';
import { Studies, LogPanel, ProPanel } from './views/Rail.jsx';
import { RoutesList } from './views/MedLog.jsx';
import { Tooltip } from './views/Tooltip.jsx';

const stageKey = () =>
  'stage-' + S.stage +
  (S.stage === 'ps' && S.study ? '-' + S.study.c + (S.qon ? '-q' : '') : '') +
  (S.stage === 'finish' && S.saved ? '-saved' : '');

const VIEWS = { id: Identity, qc: QuickCheck, ps: PreScreen, finish: Finish };

/* The leaving stage keeps its last frame: its version prop stops changing, so memo skips re-rendering it. */
const Frozen = memo(function Frozen({ V }) { return <V />; });

/** Stages replace each other in place: the old one leaves (popLayout) while the new one's pieces stagger in. */
function StageHost() {
  const V = VIEWS[S.stage];
  return (
    <div className="stage-host">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={stageKey()} variants={STAGE} initial="hide" animate="show" exit={STAGE_EXIT()}>
          <Frozen V={V} v={getVersion()} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Splitter({ gridRef }) {
  const onDown = (e) => {
    e.preventDefault();
    const h = e.currentTarget, g = gridRef.current, r = g.getBoundingClientRect();
    h.classList.add('on');
    // Drags are direct: 1:1 under the pointer, no easing
    const mv = (ev) => { const w = Math.max(320, Math.min(r.width - 190, ev.clientX - r.left)); S.lw = Math.round(w); g.style.gridTemplateColumns = S.lw + 'px 14px minmax(0,1fr)'; };
    const up = () => { h.classList.remove('on'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); commit(); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  return <div className="split" role="separator" aria-orientation="vertical" title="Drag to resize. Double-click to reset" onPointerDown={onDown} onDoubleClick={() => upd(() => (S.lw = null))} />;
}

function onKey(e) {
  const f = e.target.dataset && e.target.dataset.f;
  if (f && /^r\./.test(f) && e.key === 'Enter') { e.preventDefault(); act('logadd'); return; }
  if (f && /^m\./.test(f) && e.key === 'Enter') { e.preventDefault(); act('madd'); return; }
  if (f === 'qs' && e.key === 'Escape') { upd(() => { S.qs = ''; S.mapOpen = false; }); return; }
  const tg = e.target.tagName || '';
  const typing = tg === 'TEXTAREA' || (tg === 'INPUT' && e.target.type !== 'checkbox') || tg === 'SELECT';
  // Enter submits the identity form from its own fields, never from a focused button elsewhere
  if (S.stage === 'id' && e.key === 'Enter' && (e.target === document.body || f === 'pid' || f === 'dob' || f === 'match')) { e.preventDefault(); act('confirm'); return; }
  if (typing || e.altKey) return;
  if ((e.key === 'u' || e.key === 'U' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) && S.last) { e.preventDefault(); act('undo'); return; }
  if (e.ctrlKey || e.metaKey) return;
  if (S.stage === 'ps' && S.qon) {
    if (e.key === '/') { e.preventDefault(); document.getElementById('qSearch')?.focus(); return; }
    if (e.key === 'Escape') { if (S.peek) act('peek:'); else if (S.qs) upd(() => (S.qs = '')); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) { const { q } = curQ(); if (q && q.a[n - 1]) act(S.mode === 'list' ? 'ansl:' + q.id + ':' + (n - 1) : 'ans:' + (n - 1)); }
    else if (e.key === 'ArrowLeft') act('prev');
    else if (e.key === 'ArrowRight') act('next');
    else if (e.key === 'Backspace' && S.nav.length) { e.preventDefault(); act('navback'); }
  }
}

/** Focus an element that may still be mounting inside an expander. */
function focusWhenReady(id, tries = 12) {
  const el = document.getElementById(id);
  if (el && !el.closest('[inert]')) {
    el.focus({ preventScroll: true });
    if (el.setSelectionRange && el.type === 'text') { const n = el.value.length; el.setSelectionRange(n, n); }
    if (document.activeElement === el) return;
  }
  if (tries) requestAnimationFrame(() => focusWhenReady(id, tries - 1));
}

export default function App() {
  useSyncExternalStore(subscribe, getVersion);
  const rootRef = useRef(null), headRef = useRef(null), gridRef = useRef(null);
  const rail = S.rail && !S.focusMode;
  const cols = rail ? (S.lw ? S.lw + 'px 14px minmax(0,1fr)' : 'minmax(0,1.5fr) 14px minmax(0,1fr)') : 'minmax(0,1fr)';

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Sticky side panel sits under the sticky header
  useEffect(() => {
    const h = headRef.current;
    if (!h || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => rootRef.current?.style.setProperty('--hh', h.offsetHeight + 'px'));
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  // Work the engine asks for after a change: scroll, focus, shake
  useLayoutEffect(() => {
    document.body.classList.toggle('dk', !!S.dark);
    document.documentElement.classList.toggle('dk', !!S.dark);
    if (S.scrollQ) {
      S.scrollQ = false;
      if (S.mode === 'list' && S.qon && S.stage === 'ps') {
        const el = document.getElementById('qr-' + S.qid);
        if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: prefersReduced() ? 'auto' : 'smooth' }));
      }
    }
    if (S.focus) { const id = S.focus; S.focus = null; focusWhenReady(id); }
    if (S.shake) {
      const k = S.shake; S.shake = null;
      const R = rootRef.current;
      let el = null, field = null;
      if (k === 'pid' || k === 'dob') el = field = R.querySelector('[data-f="' + k + '"]');
      else if (k === 'match') { el = R.querySelector('[data-shake="match"]'); field = R.querySelector('[data-f="match"]'); }
      if (!el) el = R.querySelector('.err');
      field?.focus();
      shake(el);
    }
  });

  return (
    <div id="rd" ref={rootRef} className={S.dark ? 'dk' : ''} style={{ fontSize: S.fs }}>
      <div id="h" ref={headRef}>
        <Header />
        <Steps />
      </div>
      <Guide />
      <Expander open={S.plan}><Planner /></Expander>
      <div className="grid" id="grid" ref={gridRef} style={{ gridTemplateColumns: cols }}>
        <main id="m" style={{ minWidth: 0 }}>
          <Drawer open={!rail} />
          <Expander open={S.dre.open}><DrPanel /></Expander>
          <StageHost />
        </main>
        {rail ? (
          <>
            <Splitter gridRef={gridRef} />
            <aside className="rail" id="rail" aria-label="Side panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <Drawer open />
              <Studies />
              <LogPanel />
              <ProPanel />
            </aside>
          </>
        ) : null}
      </div>
      <RoutesList />
      <Tooltip rootRef={rootRef} />
    </div>
  );
}
