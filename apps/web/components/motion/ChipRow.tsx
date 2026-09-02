'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './ChipRow.module.css';

// Real chip vocabulary — cuisines from onboarding's PreferencesScreen
// CUISINES list, situational chips from packages/shared/foodDecisionRouter.ts
// — not invented labels.
const CHIPS = ['Italian', 'Nigerian & West African', 'Quick', 'Family', 'Cheap'];

const chipVariants = (prefersReducedMotion: boolean) => ({
  hidden: { opacity: 0, scale: prefersReducedMotion ? 1 : 0.85, y: prefersReducedMotion ? 0 : 8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: prefersReducedMotion
      ? { duration: 0.01 }
      : { duration: 0.35, delay: i * 0.08, ease: 'easeOut' as const },
  }),
});

/**
 * Illustrative-only chip row for the landing page's scroll story — same
 * vocabulary as the real onboarding cuisine picker and the situational
 * chips FoodDecisionRouter matches on, but not wired to any real
 * preference state (this page renders before a visitor has an account).
 */
export function ChipRow() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.row}>
      {CHIPS.map((chip, i) => (
        <motion.span
          key={chip}
          className={styles.chip}
          custom={i}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
          variants={chipVariants(!!prefersReducedMotion)}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
        >
          {chip}
        </motion.span>
      ))}
    </div>
  );
}
