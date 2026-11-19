/* ─────────────────────────────────────────────────────────────
 * Motion tokens. Every duration and curve in the app comes from here
 * (the CSS layer in styles.css mirrors these names).
 * ───────────────────────────────────────────────────────────── */
export const EASE = {
  out: [0.32, 0.72, 0, 1], // appearing, responding to input
  in: [0.55, 0, 1, 0.45], // leaving
  io: [0.77, 0, 0.175, 1], // moving or resizing on screen
};

// seconds
export const DUR = {
  tipIn: 0.125,
  tipOut: 0.09,
  toastIn: 0.24,
  toastOut: 0.17,
  move: 0.28, // reorders, progress fill, underline sliding between steps
  stageIn: 0.35,
  stageOut: 0.15,
  rowIn: 0.24,
  rowOut: 0.15,
  shake: 0.36,
};

/* ─────────────────────────────────────────────────────────────
 * STAGE CHANGE STORYBOARD (ms after the trigger)
 *   Identity → Quick check → Pre-screen → Finish, a few times per call
 *
 *    0ms   old stage fades out with an 8px nudge up (150ms, ease-in),
 *          lifted out of layout so the new one can take its place
 *    0ms   step underline slides to the new step (280ms, ease-in-out);
 *          a finished step's number swaps to a check (spring, no bounce)
 *    0ms   first piece of the new stage rises 8px, blur 2px → 0 (350ms, ease-out)
 *   90ms   second piece
 *  180ms   third piece, and so on
 *          repeated rows inside a piece: 40ms apart, first 6 only
 * ───────────────────────────────────────────────────────────── */
export const TIMING = { exit: 0, underline: 0, firstPiece: 0, pieceGap: 90, rowGap: 40, maxStaggered: 6 };

export const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A tween on a named curve. Under reduced motion every animation is off, fades included. */
export const tr = (duration, ease = 'out', extra = {}) =>
  prefersReduced() ? { duration: 0 } : { duration, ease: EASE[ease], ...extra };

/** Icon swaps and anything that can be redirected mid-flight: a spring with no bounce. */
export const spring = (duration = 0.35) => (prefersReduced() ? { duration: 0 } : { type: 'spring', duration, bounce: 0 });

/* Stage entrance: split, then stagger */
export const STAGE = {
  hide: {},
  show: { transition: { staggerChildren: TIMING.pieceGap / 1000, delayChildren: TIMING.firstPiece / 1000 } },
};
export const PIECE = {
  hide: { opacity: 0, y: 8, filter: 'blur(2px)' },
  show: () => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: tr(DUR.stageIn) }),
};
export const STAGE_EXIT = () => ({ opacity: 0, y: -8, transition: tr(DUR.stageOut, 'in') });

/* Rows that arrive on their own (list grows, item added): 40ms apart, first 6 only */
export const rowDelay = (i) => (Math.min(i, TIMING.maxStaggered - 1) * TIMING.rowGap) / 1000;
