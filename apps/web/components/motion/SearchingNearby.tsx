'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './SearchingNearby.module.css';

// The two signal arcs, smallest first — each "beeps" in outward in turn
// (near arc, then far arc, then both off) so the pair reads as a repeating
// broadcast ping rather than a single static glyph.
const ARC_TRANSITION = (delay: number, prefersReducedMotion: boolean | null) =>
  prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 1.2, repeat: Infinity, delay, ease: 'easeInOut' as const };

/**
 * Replaces a plain "Looking nearby…" line while a local-food-search request
 * is in flight — a location pin broadcasting: two signal arcs beep outward
 * from it in sequence, on top of the same expanding "radar ping" ring used
 * before. Same visual language as AiThinking's cycling-icon treatment for
 * /decide (motion for an in-progress real lookup, not a generic spinner).
 * Purely decorative (aria-hidden); the label text next to it is the real
 * status for screen readers.
 */
export function SearchingNearby({ label = 'Looking nearby…' }: { label?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.row} role="status">
      <div className={styles.pinWrap} aria-hidden="true">
        <motion.span
          className={styles.ping}
          animate={prefersReducedMotion ? { opacity: 0.35 } : { scale: [1, 2.4], opacity: [0.5, 0] }}
          transition={
            prefersReducedMotion ? { duration: 0.01 } : { duration: 1.4, repeat: Infinity, ease: 'easeOut' }
          }
        />
        <span className={styles.pin}>📍</span>
        <svg className={styles.signal} viewBox="0 0 20 20" aria-hidden="true">
          <motion.path
            d="M11 13a3 3 0 0 1 3-3"
            animate={prefersReducedMotion ? { opacity: 0.9 } : { opacity: [0.25, 1, 0.25] }}
            transition={ARC_TRANSITION(0, prefersReducedMotion)}
          />
          <motion.path
            d="M11 13a6 6 0 0 1 6-6"
            animate={prefersReducedMotion ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }}
            transition={ARC_TRANSITION(0.25, prefersReducedMotion)}
          />
        </svg>
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
