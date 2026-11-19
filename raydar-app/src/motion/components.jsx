import { useEffect, useLayoutEffect, useRef, useState, forwardRef } from 'react';
import { AnimatePresence, motion, animate } from 'motion/react';
import { quiet } from '../engine/store.js';
import { DUR, EASE, PIECE, prefersReduced, rowDelay, spring, tr } from './tokens.js';

/**
 * Expander: opens with grid rows 0fr → 1fr (250ms) and closes in 190ms, both ease-in-out,
 * while its content fades and nudges. Content stays mounted until the close finishes,
 * is inert while closed, and reversing mid-way turns around from where it is.
 * After a high-frequency action (answering, navigating) it opens and closes instantly.
 */
export function Expander({ open, children, instant, className = '', style }) {
  const now = instant ?? (quiet() || prefersReduced());
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  const [settled, setSettled] = useState(open);
  const [snap, setSnap] = useState(false);
  const ref = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    if (open) {
      setSnap(now);
      if (!mounted) { setMounted(true); return; }
      if (!shown) {
        ref.current?.getBoundingClientRect(); // commit the closed state so the change transitions
        setShown(true);
        if (now) setSettled(true);
      }
    } else if (mounted) {
      setSnap(now);
      setSettled(false);
      setShown(false);
      if (now) setMounted(false);
    }
  }, [open, mounted, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open || !mounted || now) return;
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (inner.current) inner.current.inert = !shown; }, [shown, mounted]);

  if (!mounted) return null;
  return (
    <div
      ref={ref}
      className={'xp ' + className}
      style={style}
      data-open={shown ? '' : undefined}
      data-settled={settled ? '' : undefined}
      data-instant={snap ? '' : undefined}
      onTransitionEnd={(e) => { if (e.target === ref.current && e.propertyName === 'grid-template-rows' && shown) setSettled(true); }}
    >
      <div className="xin" ref={inner}>
        <div className="xfade">{children}</div>
      </div>
    </div>
  );
}

/** Icon swap: deep scale 0.3 → 1, opacity and a 3px blur, on a spring with no bounce. */
export function IconSwap({ k, children, style }) {
  return (
    <span style={{ display: 'inline-grid', ...style }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={k}
          style={{ gridArea: '1/1', display: 'inline-flex' }}
          initial={{ scale: 0.3, opacity: 0, filter: 'blur(3px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          exit={{ scale: 0.3, opacity: 0, filter: 'blur(3px)' }}
          transition={spring()}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** One piece of a stage. Pieces enter 90ms apart (see the storyboard in tokens.js). */
export const Piece = forwardRef(function Piece({ as = 'div', children, ...rest }, ref) {
  const C = motion[as];
  return <C ref={ref} variants={PIECE} {...rest}>{children}</C>;
});

/** Error on submit: the wrong field shakes once, 360ms. Never on blur. */
export function shake(el) {
  if (!el || prefersReduced()) return;
  animate(el, { x: [0, -10, 10, -6, 6, -3, 0] }, { duration: DUR.shake, ease: EASE.out });
}

/** Error text arrives beside the field it belongs to. */
export function Err({ msg }) {
  return (
    <AnimatePresence initial={false}>
      {msg ? (
        <motion.p
          key="e"
          className="err"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, transition: tr(0.2) }}
          exit={{ opacity: 0, transition: tr(0.12, 'in') }}
        >
          {msg}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * A row in a list that grows and shrinks (logged meds, studies, away dates).
 * New rows rise 8px and fade in, 40ms apart for the first 6; removed rows fade out
 * while their siblings close the gap with a transform (FLIP), never by animating height.
 */
export const Row = forwardRef(function Row({ i = 0, children, className, style, as = 'div', ...rest }, ref) {
  const C = motion[as];
  const still = quiet() || prefersReduced();
  return (
    <C
      ref={ref}
      layout="position"
      className={className}
      style={style}
      initial={still ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: tr(DUR.rowIn, 'out', { delay: rowDelay(i) }) }}
      exit={{ opacity: 0, transition: tr(DUR.rowOut, 'in') }}
      transition={{ layout: tr(DUR.move, 'io') }}
      {...rest}
    >
      {children}
    </C>
  );
});
