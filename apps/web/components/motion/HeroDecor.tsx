'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './HeroDecor.module.css';

interface Piece {
  src: string;
  alt: string;
  className: string;
  delay: number;
  rotate?: number;
}

// Real cutout PNGs — tomatoes/onions/leaves from images/fruits/, burger from
// images/drink/. All already transparent, trimmed + resized — see
// apps/web/public/decor/. Clustered along the banner's base (bottom-left +
// bottom-right) — keeps the nav/logo area at the top clean. The board ("the
// plate") is turned 90° so its flat edge runs along the base — the rotation
// lives here (in framer-motion's animate/initial) rather than as CSS
// `transform` on .basil, because framer-motion writes its own inline
// `transform` on animate and would otherwise silently clobber a CSS one.
// Burger is folded into the bottom-right cluster (overlapping onion/tomato)
// rather than given its own separate corner, so it reads as one mixed
// spread instead of a bolted-on addition. It sits as a large, blown-up
// backdrop tucked behind the corner — it's listed before onion/tomato here
// (paint order follows DOM order for these unlayered absolutely-positioned
// siblings) so both paint on top of it instead of covering them. The drink
// (OJ glass) piece that used to sit here was removed per request.
const PIECES: Piece[] = [
  { src: '/decor/basil.png', alt: '', className: styles.basil, delay: 0.08, rotate: 90 },
  { src: '/decor/burger.png', alt: '', className: styles.burger, delay: 0.12 },
  { src: '/decor/onion.png', alt: '', className: styles.onion, delay: 0.2 },
  { src: '/decor/tomato.png', alt: '', className: styles.tomato, delay: 0.32 },
];

interface LeafSpec {
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
}

// Small leaf confetti spread along the banner's base strip (not the whole
// hero) — sits with the ingredient clusters down there instead of
// competing with the headline higher up. Fixed, hand-placed positions —
// not Math.random() — so server and client render the same markup.
const LEAVES: LeafSpec[] = [
  { top: '70%', left: '8%', size: 18, rotate: 15, opacity: 0.22 },
  { top: '76%', left: '22%', size: 13, rotate: -30, opacity: 0.18 },
  { top: '68%', left: '38%', size: 20, rotate: 60, opacity: 0.16 },
  { top: '82%', left: '50%', size: 15, rotate: -10, opacity: 0.2 },
  { top: '72%', left: '62%', size: 21, rotate: 100, opacity: 0.15 },
  { top: '88%', left: '15%', size: 15, rotate: 45, opacity: 0.2 },
  { top: '90%', left: '35%', size: 17, rotate: -60, opacity: 0.14 },
  { top: '78%', left: '72%', size: 13, rotate: 20, opacity: 0.18 },
  { top: '94%', left: '58%', size: 19, rotate: -45, opacity: 0.16 },
  { top: '84%', left: '85%', size: 15, rotate: 80, opacity: 0.2 },
  { top: '96%', left: '5%', size: 21, rotate: -20, opacity: 0.15 },
  { top: '74%', left: '92%', size: 13, rotate: 130, opacity: 0.18 },
  { top: '86%', left: '44%', size: 17, rotate: -90, opacity: 0.16 },
  { top: '92%', left: '78%', size: 19, rotate: 35, opacity: 0.2 },
  { top: '66%', left: '28%', size: 14, rotate: -15, opacity: 0.18 },
  { top: '98%', left: '20%', size: 22, rotate: 50, opacity: 0.14 },
  { top: '80%', left: '96%', size: 15, rotate: -70, opacity: 0.19 },
  { top: '70%', left: '65%', size: 16, rotate: 10, opacity: 0.17 },
];

function Leaf({ top, left, size, rotate, opacity }: LeafSpec) {
  return (
    <svg
      className={styles.leaf}
      style={{ top, left, width: size, height: size, opacity, transform: `rotate(${rotate}deg)` }}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d="M16 2C8 2 3 10 3 18C3 24 9 29 16 29C23 29 29 24 29 18C29 10 24 2 16 2Z" fill="currentColor" />
      <path d="M16 5V27" stroke="rgba(14, 81, 53, 0.35)" strokeWidth="1" />
    </svg>
  );
}

export function HeroDecor() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.layer} aria-hidden="true">
      {LEAVES.map((leaf, i) => (
        <Leaf key={i} {...leaf} />
      ))}

      {PIECES.map((piece) => (
        <motion.div
          key={piece.src}
          className={`${styles.piece} ${piece.className}`}
          initial={{ opacity: 0, scale: 0.85, rotate: piece.rotate ?? 0 }}
          animate={{ opacity: 0.92, scale: 1, rotate: piece.rotate ?? 0 }}
          transition={{
            duration: prefersReducedMotion ? 0.01 : 0.6,
            delay: prefersReducedMotion ? 0 : piece.delay,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
        >
          <Image src={piece.src} alt={piece.alt} fill sizes="400px" style={{ objectFit: 'contain' }} priority />
        </motion.div>
      ))}
    </div>
  );
}
