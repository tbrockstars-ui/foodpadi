'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './HeroDecor.module.css';

interface Piece {
  src: string;
  className: string;
  /** Peak upward drift, px, for the idle float loop. */
  floatOffset: number;
  /** Idle float loop duration, s — varied per piece so they don't move in lockstep. */
  floatDuration: number;
  /** Entrance stagger, s. */
  delay: number;
  /** Resting tilt, deg. */
  rotate: number;
  /** Resting opacity (these sit behind the headline, so slightly held back). */
  opacity: number;
}

// Real, isolated food photography (cutout PNGs, transparent) curated from the
// project's image/drink set — resized into apps/web/public/decor/. The juice
// bottle that used to anchor the lower-right is gone (its asset remains in
// public/decor/ but is no longer referenced) — replaced by the salad bowl as
// the lower-right corner anchor, with the two burgers set on their own (one
// on the right edge at mid-height, one in the lower-centre band), plus the
// tomato & basil accent higher up the right edge. The two left-side accents
// nearest the logo (olive-oil bottle, grilled-chicken bowl) were removed to
// keep that side clean around the badge. Different scales, tilts and float
// rhythms give the group depth; entrance delays are grouped into batches
// (anchor, then the corner + burgers, then the upper accent, then the herbs)
// so the whole composition cascades in rather than appearing all at once.
const PIECES: Piece[] = [
  // Batch 1 — the left anchor.
  { src: '/decor/salad-toss.png', className: styles.saladToss, floatOffset: 14, floatDuration: 7.5, delay: 0.1, rotate: -3, opacity: 1 },
  // Batch 2 — the lower-right corner anchor (salad bowl) plus the two
  // burgers, now placed independently (see the CSS for where each lands).
  { src: '/decor/salad-bowl.png', className: styles.saladBowl, floatOffset: 10, floatDuration: 7.2, delay: 0.4, rotate: -4, opacity: 1 },
  { src: '/decor/burger-crispy.png', className: styles.burgerCrispy, floatOffset: 8, floatDuration: 6.6, delay: 0.5, rotate: 6, opacity: 0.97 },
  { src: '/decor/burger-fries.png', className: styles.burgerFries, floatOffset: 7, floatDuration: 7.8, delay: 0.6, rotate: -6, opacity: 0.95 },
  // Batch 3 — one further accent higher up the right edge.
  { src: '/decor/tomato-basil.png', className: styles.tomatoBasil, floatOffset: 8, floatDuration: 7, delay: 0.74, rotate: 5, opacity: 0.96 },
];

interface HerbSpec {
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
  floatOffset: number;
  floatDuration: number;
  delay: number;
}

// A few real basil sprigs as micro depth accents in the lower band — replaces
// the old flat SVG leaf confetti. Kept deliberately sparse (clutter is a
// failure mode here) and low-opacity so they never compete with the text.
// Fixed hand-placed positions so SSR and client markup match. Batch 4 —
// the last thing to settle in, after the photographic pieces above.
const HERBS: HerbSpec[] = [
  { top: '82%', left: '34%', size: 34, rotate: 24, opacity: 0.5, floatOffset: 6, floatDuration: 7.8, delay: 1.1 },
  { top: '20%', left: '90%', size: 38, rotate: -30, opacity: 0.55, floatOffset: 6, floatDuration: 8.2, delay: 1.26 },
];

export function HeroDecor() {
  const reduce = useReducedMotion();

  return (
    <div className={styles.layer} aria-hidden="true">
      {PIECES.map((piece) => (
        <motion.div
          key={piece.src}
          className={`${styles.piece} ${piece.className}`}
          initial={reduce ? false : { opacity: 0, y: 26, scale: 0.9, rotate: piece.rotate }}
          animate={
            reduce
              ? { opacity: piece.opacity, rotate: piece.rotate }
              : { opacity: piece.opacity, scale: 1, rotate: piece.rotate, y: [26, 0, -piece.floatOffset, 0] }
          }
          transition={
            reduce
              ? { duration: 0.01 }
              : {
                  opacity: { duration: 0.7, delay: piece.delay, ease: 'easeOut' },
                  scale: { duration: 0.7, delay: piece.delay, ease: [0.21, 0.47, 0.32, 0.98] },
                  rotate: { duration: 0.7, delay: piece.delay, ease: 'easeOut' },
                  y: {
                    duration: piece.floatDuration,
                    delay: piece.delay,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                  },
                }
          }
        >
          <Image src={piece.src} alt="" fill sizes="(max-width: 720px) 40vw, 360px" style={{ objectFit: 'contain' }} priority />
        </motion.div>
      ))}

      {HERBS.map((herb, i) => (
        <motion.div
          key={i}
          className={styles.herb}
          style={{ top: herb.top, left: herb.left, width: herb.size, height: herb.size }}
          initial={reduce ? false : { opacity: 0, y: 14, rotate: herb.rotate }}
          animate={
            reduce
              ? { opacity: herb.opacity, rotate: herb.rotate }
              : { opacity: herb.opacity, rotate: herb.rotate, y: [14, 0, -herb.floatOffset, 0] }
          }
          transition={
            reduce
              ? { duration: 0.01 }
              : {
                  opacity: { duration: 0.8, delay: herb.delay },
                  rotate: { duration: 0.8, delay: herb.delay },
                  y: {
                    duration: herb.floatDuration,
                    delay: herb.delay,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                  },
                }
          }
        >
          <Image src="/decor/herb-basil.png" alt="" fill sizes="48px" style={{ objectFit: 'contain' }} />
        </motion.div>
      ))}
    </div>
  );
}
