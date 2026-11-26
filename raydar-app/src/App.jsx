import { memo, Suspense, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { S, act, ansOrder, commit, curQ, getVersion, nextStep, ranked, subscribe, upd } from './engine/store.js';
import { KEY_ACTIONS, UNBINDABLE, actionFor, bind, keyLabel, keyName } from './engine/keys.js';
import { Expander, shake } from './motion/components.jsx';
import { STAGE, STAGE_EXIT, prefersReduced } from './motion/tokens.js';
import { Header, Steps, Guide } from './views/Header.jsx';
import { Identity, QuickCheck } from './views/Intake.jsx';
import { PreScreen } from './views/PreScreen.jsx';
import { Finish } from './views/Finish.jsx';
import { Planner } from './views/Planner.jsx';
import { DrPanel } from './views/DrPanel.jsx';
import { Drawer, markBound } from './views/Drawer.jsx';
import { Studies, LogPanel, ProPanel } from './views/Rail.jsx';
import { Safe } from './views/Safe.jsx';
import { RoutesList } from './views/MedLog.jsx';
import { Tooltip } from './views/Tooltip.jsx';
import { FolderBanner } from './views/Folder.jsx';
import { autoConnect, startUpdateChecks } from './esource/connect.js';
import { SOURCE } from './esource/studies.js';
import { ADMIN_MODE, AdminApp } from './admin/gate.js';
import { PreviewBar } from './views/PreviewBar.jsx';
import { TestBanner } from './views/TestMode.jsx';

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

const ACT_LABEL = Object.fromEntries(KEY_ACTIONS.map((a) => [a[0], a[1]]));

/** Capture the next key press for the shortcut being changed (Tools → Keyboard shortcuts). */
function rebindKey(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') { upd(() => { S.rebind = null; S.keyMsg = 'No change'; }); return; }
  if (UNBINDABLE.has(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
  const id = S.rebind, other = bind(id, e.key);
  markBound();
  upd(() => {
    S.rebind = null;
    S.keyMsg = ACT_LABEL[id] + ': ' + keyLabel(e.key) + (other ? '. ' + ACT_LABEL[other] + ' moved to ' + keyName(other) : '');
  });
}

function onKey(e) {
  if (S.admin) return; // 2.8: the study admin has its own keys
  if (S.rebind) { rebindKey(e); return; }
  // 2.10: a key a box has already used (Enter or Tab filling a suggestion) does nothing more here
  if (e.defaultPrevented) return;
  const f = e.target.dataset && e.target.dataset.f;
  if (f && /^r\./.test(f) && e.key === 'Enter') { e.preventDefault(); act('logadd'); return; }
  if (f && /^m\./.test(f) && e.key === 'Enter') { e.preventDefault(); act('madd:med'); return; }
  if (f && /^h\./.test(f) && e.key === 'Enter') { e.preventDefault(); act('madd:hx'); return; }
  // 2.5: Enter records a typed answer; Shift+Enter starts a new line in a longer box
  if (f === 'qt' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); act('anst:' + e.target.dataset.q); return; }
  if (f === 'qs' && e.key === 'Escape') { upd(() => { S.qs = ''; S.mapOpen = false; }); return; }
  const tg = e.target.tagName || '';
  // Enter submits the identity form from its own fields, never from a focused button elsewhere
  if (S.stage === 'id' && e.key === 'Enter' && (e.target === document.body || f === 'pid' || f === 'dob' || f === 'match')) { e.preventDefault(); act('confirm'); return; }
  // Enter in a number field (weight, height, drinks) can still continue to the next step
  const numField = tg === 'INPUT' && (e.target.type === 'number' || e.target.type === 'date');
  const typing = tg === 'TEXTAREA' || (tg === 'INPUT' && e.target.type !== 'checkbox' && !(numField && e.key === 'Enter')) || tg === 'SELECT';
  if (typing || e.altKey) return;
  if (e.key === 'z' && (e.ctrlKey || e.metaKey) && S.last) { e.preventDefault(); act('undo'); return; }
  if (e.ctrlKey || e.metaKey) return;
  // A focused button or link keeps its own Enter and Space
  if ((e.key === 'Enter' || e.key === ' ') && (tg === 'BUTTON' || tg === 'A')) return;
  const id = actionFor(e.key);
  if (id === 'undo') { if (S.last) { e.preventDefault(); act('undo'); } return; }
  // 2.6: the call script, and choosing a study by number
  if (e.key === 'Escape' && S.script) { e.preventDefault(); act('script:close'); return; }
  if (id === 'script' && S.stage === 'ps' && S.study) { e.preventDefault(); act('script:side'); return; }
  if (S.stage === 'ps' && !S.study && /^[1-9]$/.test(e.key)) {
    const order = ['yes', 'check', 'no'], L = ranked().slice().sort((a, b) => order.indexOf(a.r[0]) - order.indexOf(b.r[0])), x = L[+e.key - 1];
    if (x) { e.preventDefault(); act('start:' + x.s.c); }
    return;
  }
  if (id === 'cont') {
    // 2.5: on a multi-select question, the continue key records what's ticked
    if (S.stage === 'ps' && S.qon) { const cq = curQ().q; if (cq && cq.kind === 'multi') { e.preventDefault(); act('ansm:' + cq.id); return; } }
    const n = nextStep(); if (n) { e.preventDefault(); act(n.a); } return;
  }
  if (!(S.stage === 'ps' && S.qon)) return;
  if (e.key === 'Escape') { if (S.peek) act('peek:'); else if (S.qs) upd(() => (S.qs = '')); return; }
  if (!id) return;
  const { q } = curQ();
  if (/^ans\d$/.test(id)) {
    if (!q) return;
    if (q.kind === 'multi') { const j = +id.slice(3) - 1; if (q.a[j]) { e.preventDefault(); act('pick:' + q.id + ':' + j); } return; }
    if (q.kind === 'text') { e.preventDefault(); document.querySelector('[data-f="qt"][data-q="' + CSS.escape(q.id) + '"]')?.focus(); return; }
    const j = ansOrder(q)[+id.slice(3) - 1];
    if (j == null) return;
    e.preventDefault();
    act(S.mode === 'list' ? 'ansl:' + q.id + ':' + j : 'ans:' + j);
  }
  else if (id === 'search') { e.preventDefault(); document.getElementById('qSearch')?.focus(); }
  else if (id === 'prev') { e.preventDefault(); act('prev'); }
  else if (id === 'next') { e.preventDefault(); act('next'); }
  else if (id === 'back') { if (S.nav.length) { e.preventDefault(); act('navback'); } }
  else if (id === 'park') { if (q && !S.out[q.id] && S.mode === 'one') { e.preventDefault(); act('park'); } }
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
  // 2.6: the header shrinks to one line once you scroll down, and returns at the top (a gap between the two
  // thresholds stops it flickering as the page height changes)
  const [slim, setSlim] = useState(false);
  useEffect(() => {
    const on = () => setSlim((v) => (v ? window.scrollY > 8 : window.scrollY > 80));
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const cols = rail ? (S.lw ? S.lw + 'px 14px minmax(0,1fr)' : 'minmax(0,1.5fr) 14px minmax(0,1fr)') : 'minmax(0,1fr)';

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  // 2.8: read the shared studies folder picked last time, if Chrome still allows it without a click
  // and keep an eye on the studies file in _system: a publish reaches a RAYDAR that's open all day.
  // Between calls (no participant started) it switches over by itself; during a call it asks.
  useEffect(() => { if (!SOURCE.preview) { autoConnect(); startUpdateChecks(() => !SOURCE.preview && !S.admin && S.stage === 'id' && !S.pid); } }, []);

  // Sticky side panel and question toolbar sit under the sticky header.
  // 2.8 fix: the study admin replaces the call screens, so coming back from it makes a new header. Measure the new
  // one; measuring only the first left --hh stuck at an old height (a gap above the side panel once the header shrank).
  const inAdmin = !!(AdminApp && ADMIN_MODE === 'combined' && S.admin);
  useEffect(() => {
    const h = headRef.current;
    if (!h || typeof ResizeObserver === 'undefined') return;
    const set = () => rootRef.current?.style.setProperty('--hh', h.offsetHeight + 'px');
    set();
    const ro = new ResizeObserver(set);
    ro.observe(h);
    return () => ro.disconnect();
  }, [inAdmin]);

  // Work the engine asks for after a change: scroll, focus, shake
  useLayoutEffect(() => {
    document.body.classList.toggle('dk', !!S.dark);
    document.documentElement.classList.toggle('dk', !!S.dark);
    document.body.classList.toggle('tm', !!S.tm); // 2.10 test mode: pink frame, no trial banner
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

  // 2.8: the all-in-one file opens the study admin in place of the call screens
  if (AdminApp && ADMIN_MODE === 'combined' && S.admin) {
    return (
      <div id="rd" className={S.dark ? 'dk' : ''} style={{ fontSize: S.fs }}>
        <Suspense fallback={<p className="mut">Opening the study admin…</p>}><AdminApp embedded onExit={() => act('admin:close')} /></Suspense>
      </div>
    );
  }
  return (
    <div id="rd" ref={rootRef} className={(S.dark ? 'dk' : '') + (slim ? ' slim' : '')} style={{ fontSize: S.fs }}>
      {SOURCE.preview ? <PreviewBar /> : null}
      <div id="h" ref={headRef}>
        <TestBanner />
        <Header />
        <Steps />
      </div>
      <Guide />
      <FolderBanner />
      <Safe name="Compare dates"><Expander open={S.plan}><Planner /></Expander></Safe>
      <div className="grid" id="grid" ref={gridRef} style={{ gridTemplateColumns: cols }}>
        <main id="m" style={{ minWidth: 0 }}>
          <Safe name="Tools"><Drawer open={!rail} /></Safe>
          <Safe name="Dr enquiry"><Expander open={S.dre.open}><DrPanel /></Expander></Safe>
          <Safe name="The main panel"><StageHost /></Safe>
        </main>
        {rail ? (
          <>
            <Splitter gridRef={gridRef} />
            <aside className="rail" id="rail" aria-label="Side panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <Safe name="Tools"><Drawer open /></Safe>
              <Safe name="Pivotable studies"><Studies /></Safe>
              <Safe name="Meds and history"><LogPanel /></Safe>
              <Safe name="Prohibited list"><ProPanel /></Safe>
            </aside>
          </>
        ) : null}
      </div>
      <RoutesList />
      <Tooltip rootRef={rootRef} />
    </div>
  );
}
