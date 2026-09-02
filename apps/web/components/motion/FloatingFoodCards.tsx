'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './FloatingFoodCards.module.css';

/**
 * The hero's animated visual: a translucent glass "what should I eat now?"
 * card settles into the stage. The four floating idea pills (Pasta, Curry,
 * Fresh bowl, Beans & rice) that used to scatter above it are gone —
 * removed on request, purely decorative, not missed functionally. Collapses
 * to an instant, static layout under prefers-reduced-motion — nothing here
 * is required to understand the page.
 */
export function FloatingFoodCards() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.stage}>
      <motion.div
        className={styles.questionCard}
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, delay: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
      >
        <span className={styles.questionIcon} aria-hidden="true">
          🍽️
        </span>
        <p className={styles.questionText}>What should I eat now?</p>
      </motion.div>
    </div>
  );
}
