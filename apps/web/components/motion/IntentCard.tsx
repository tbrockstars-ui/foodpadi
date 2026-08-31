'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { ImageAsset } from '../../lib/imageAssets';
import styles from './IntentCard.module.css';

interface IntentCardProps {
  href: string;
  badge: string;
  label: string;
  subtitle: string;
  image: ImageAsset;
  accent: 'right-now' | 'cooking' | 'plan-ahead';
}

/**
 * One of the three "journeys" on Home (Right now / Cooking / Plan ahead) —
 * each gets its own photo and accent colour rather than looking like an
 * identical flat card three times over. Hover *and* tap both trigger the
 * lift/zoom (whileHover + whileTap), since hover-only feedback is invisible
 * on mobile, which is most of FoodPadi's real usage.
 */
export function IntentCard({ href, badge, label, subtitle, image, accent }: IntentCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <Link href={href} className={`${styles.card} ${styles[accent]}`}>
      <motion.div
        className={styles.imageWrap}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'tween', duration: 0.18 }}
      >
        {/* Always above the fold on Home — eager, not lazy (brief's own
            "lazy-load what's below the fold" rule implies the inverse for
            what's already on screen at load). */}
        <img src={image.url} alt={image.alt} className={styles.image} />
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      </motion.div>
      <p className={styles.label}>{label}</p>
      <p className={styles.subtitle}>{subtitle}</p>
    </Link>
  );
}
