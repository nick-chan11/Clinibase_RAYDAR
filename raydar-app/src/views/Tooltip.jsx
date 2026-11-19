import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { S, add, tlB, ZP, tipAway } from '../engine/store.js';
import { DUR, tr } from '../motion/tokens.js';

function TipBody({ t }) {
  const L = t.split('\n');
  const g = L.slice(2).filter(Boolean).map((x) => x.split('::'));
  return (
    <>
      <div className="tt">{L[0]}</div>
      {L[1] ? <div className="ts">{L[1]}</div> : null}
      {g.length ? <div className="tg">{g.map((p, i) => [<span key={i + 'a'}>{p[0]}</span>, <span key={i + 'b'}>{p[1] || ''}</span>])}</div> : null}
    </>
  );
}

/**
 * Hover dates. 125ms in, 90ms out, fading and scaling from 0.97 at the cursor.
 * Moving straight to a neighbour keeps it open and swaps the content with no animation.
 */
export function Tooltip({ rootRef }) {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);
  const hideT = useRef(null);
  useEffect(() => {
    const R = rootRef.current;
    if (!R) return;
    const hideSoon = () => { clearTimeout(hideT.current); hideT.current = setTimeout(() => setTip(null), 80); };
    const move = (e) => {
      let t = null;
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el) t = el.dataset.tip;
      else {
        const tl = e.target.closest && e.target.closest('#tlIn');
        if (tl && S.away.length) {
          const r = tl.getBoundingClientRect(), d = add(tlB().start, Math.floor((e.clientX - r.left) / ZP()));
          const a = S.away.find((a) => a[0] <= d && d <= a[1]);
          if (a) t = tipAway(a);
        }
      }
      if (!t) return hideSoon();
      clearTimeout(hideT.current);
      setTip({ t, x: e.clientX, y: e.clientY });
    };
    const hideNow = () => { clearTimeout(hideT.current); setTip(null); };
    R.addEventListener('mousemove', move);
    R.addEventListener('mouseleave', hideNow);
    window.addEventListener('scroll', hideNow, true);
    return () => { R.removeEventListener('mousemove', move); R.removeEventListener('mouseleave', hideNow); window.removeEventListener('scroll', hideNow, true); };
  }, [rootRef]);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const T = ref.current, w = T.offsetWidth, h = T.offsetHeight;
    let x = tip.x + 14, y = tip.y + 16;
    if (x + w > innerWidth - 8) x = tip.x - w - 14;
    if (y + h > innerHeight - 8) y = tip.y - h - 12;
    T.style.left = Math.max(4, x) + 'px';
    T.style.top = Math.max(4, y) + 'px';
  });

  return (
    <AnimatePresence>
      {tip ? (
        <motion.div
          key="tip" id="rdtip" ref={ref} role="tooltip"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1, transition: tr(DUR.tipIn) }}
          exit={{ opacity: 0, scale: 0.97, transition: tr(DUR.tipOut, 'in') }}
        >
          <TipBody t={tip.t} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
