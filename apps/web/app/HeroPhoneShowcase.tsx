'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './HeroPhoneShowcase.module.css';

/**
 * Left column of the hero — a single static banner image (the designer's
 * own composite of the phone mockup, "Take FoodPadi with you!" caption, and
 * the vegetable/leaf photos, all pre-arranged together) rather than the
 * separately-recreated pieces earlier passes used. Supersedes those pieces
 * per user instruction 2026-09-16 ("use the static left_banner_image.png…
 * to replace the exact location in the current banner").
 *
 * hero-left-banner.png is that source file with its flat/gradient green
 * background colour-keyed out to real alpha transparency (same per-pixel
 * colour-distance technique as the earlier individual food photos — see
 * HeroFeatureList.tsx's doc comment for why that beats a CSS mask), so it
 * blends into .hero's own background instead of showing as a box. Re-exported
 * by the designer as left_image_banner.png (2026-09-16) without the
 * "FoodPadi" logo/wordmark baked in this time (the page's real nav already
 * renders that once, in the row above) and without the small seam gap the
 * previous export had near the phone's bottom-right corner — so unlike the
 * first export, this one needs no top crop and no gap-covering garnish leaf.
 */
export function HeroPhoneShowcase() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.wrap}>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.01 : 0.6, delay: prefersReducedMotion ? 0 : 0.1, ease: 'easeOut' }}
      >
        <Image
          src="/decor/hero-left-banner.png"
          alt="The FoodPadi app open on a phone, showing the 'What should I eat today?' prompt with Cook, Plan and Nearby shortcuts — 'Take FoodPadi with you!'"
          width={1302}
          height={1208}
          sizes="(max-width: 980px) 320px, 480px"
          className={styles.bannerImg}
          priority
        />
      </motion.div>
    </div>
  );
}
