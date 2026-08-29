'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in seconds — use when several ScrollReveals sit in one section. */
  delay?: number;
  /** 'up' (default) slides in from below; 'none' only fades, for text-heavy blocks. */
  direction?: 'up' | 'none';
}

const VARIANTS: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const VARIANTS_FADE_ONLY: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/**
 * The one place scroll-triggered "fade + slide up as it enters the
 * viewport" motion lives — every landing-page section below the hero uses
 * this instead of hand-rolling its own useInView logic. Reduced-motion users
 * get an instant, un-animated appearance (still using the same variants, just
 * a near-zero transition) rather than the content ever depending on motion
 * to become visible at all.
 */
export function ScrollReveal({ children, className, delay = 0, direction = 'up' }: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={direction === 'none' ? VARIANTS_FADE_ONLY : VARIANTS}
      transition={{
        duration: prefersReducedMotion ? 0.01 : 0.5,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </motion.div>
  );
}
