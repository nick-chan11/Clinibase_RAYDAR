import { AnimatePresence, motion } from 'motion/react';
import { nextStep } from '../engine/store.js';
import { keyName } from '../engine/keys.js';
import { A, Ic, B } from './ui.jsx';
import { DUR, spring, tr } from '../motion/tokens.js';

/**
 * Next-step prompt (RAYDAR 2.4). Appears once the current stage is complete and points at the next one:
 * Identity → Quick check → Pre-screen → Finish → next call. The Continue key (Enter by default) does the same.
 * `sticky` keeps it on screen at the bottom of long stages such as the quick check.
 */
export function NextStep({ sticky, style }) {
  const n = nextStep();
  const tone = n && n.tone ? n.tone : 'ok';
  return (
    <AnimatePresence initial={false}>
      {n ? (
        <motion.div
          key={n.a}
          className={'nextstep' + (sticky ? ' sticky' : '')}
          style={style}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: tr(DUR.promptIn) }}
          exit={{ opacity: 0, y: 8, transition: tr(DUR.toastOut, 'in') }}
        >
          <motion.i
            className={'ti ti-circle-check ns-ic ' + tone}
            aria-hidden="true"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { ...spring(0.4), delay: 0.08 } }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <B>{n.done}</B>
            <span className="ns-sub">
              Next: <B style={{ color: 'var(--text-primary)' }}>{n.to}</B>{n.sub ? ' · ' + n.sub : ''}
            </span>
          </span>
          <button className="pill pri ns-btn" {...A(n.a)}>
            {n.btn} <Ic n="ti-arrow-right" /> <span className="k">{keyName('cont')}</span>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
