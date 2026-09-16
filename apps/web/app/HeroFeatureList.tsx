'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './HeroFeatureList.module.css';

/**
 * Right column of the hero — a single static banner image (the designer's
 * own composite of the Decide/Cook/Find/Plan icon list, the bowl/board food
 * photos, and the "Real food. Smarter choices." tagline) rather than the
 * separately-recreated pieces earlier passes used. Supersedes those pieces
 * per user instruction 2026-09-16 ("use the static right_banner_image.png…
 * to replace the exact location in the current banner"). Lists the same
 * four real capabilities DecideFlow already offers (Cook It / Find Nearby on
 * a result, Cook Today, Plan Ahead) — this is just how they're now
 * presented before the customer has typed anything, not a new feature.
 *
 * hero-right-banner.png is that source file with its flat green background
 * colour-keyed out to real alpha transparency — see HeroPhoneShowcase.tsx's
 * doc comment for the technique and why it replaced an earlier CSS-mask
 * approach.
 */
export function HeroFeatureList() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.wrap}>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.01 : 0.6, delay: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      >
        <Image
          src="/decor/hero-right-banner.png"
          alt="Decide what to eat, cook with what you have, find food nearby, and plan your meals — real food, smarter choices"
          width={645}
          height={699}
          sizes="(max-width: 980px) 300px, 420px"
          className={styles.bannerImg}
        />
      </motion.div>
    </div>
  );
}
