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
// project's image/drink set — resized into apps/web/public/decor/. This is a
// deliberate three-piece composition, not scattered decoration: one large
// anchor (the salad toss — "decide what to eat", with its own built-in
// ingredient motion), one warm vibrant accent (the juice, an orange pop
// against the green banner), and one smaller supporting option (the grilled
// chicken bowl) peeking in from the edge. Different scales, tilts and float
// rhythms give the group depth. The old burger / tomato / onion / board
// cutouts are gone — their assets remain in public/decor/ but are no longer
// referenced here.
const PIECES: Piece[] = [
  { src: '/decor/salad-toss.png', className: styles.saladToss, floatOffset: 14, floatDuration: 7.5, delay: 0.1, rotate: -3, opacity: 1 },
  { src: '/decor/juice.png', className: styles.juice, floatOffset: 11, floatDuration: 6.2, delay: 0.24, rotate: 4, opacity: 0.98 },
  { src: '/decor/bowl-chicken.png', className: styles.bowlChicken, floatOffset: 9, floatDuration: 8.4, delay: 0.38, rotate: 7, opacity: 0.94 },
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
// Fixed hand-placed positions so SSR and client markup match.
const HERBS: HerbSpec[] = [
  { top: '30%', left: '2%', size: 44, rotate: -18, opacity: 0.62, floatOffset: 7, floatDuration: 6.5, delay: 0.5 },
  { top: '82%', left: '34%', size: 34, rotate: 24, opacity: 0.5, floatOffset: 6, floatDuration: 7.8, delay: 0.62 },
  { top: '68%', left: '62%', size: 30, rotate: 40, opacity: 0.5, floatOffset: 7, floatDuration: 7, delay: 0.7 },
  { top: '20%', left: '90%', size: 38, rotate: -30, opacity: 0.55, floatOffset: 6, floatDuration: 8.2, delay: 0.82 },
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
