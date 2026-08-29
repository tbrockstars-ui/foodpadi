'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './AiThinking.module.css';

const INGREDIENTS = ['🥕', '🍅', '🍗', '🍽️'];

/**
 * Replaces a plain "Loading…" while FoodPadi's /decide call is in flight —
 * a short, cycling ingredient sequence rather than a spinner, so waiting for
 * a real AI-blended answer still feels like part of the food experience.
 * Purely decorative (aria-hidden); "FoodPadi is thinking…" is the real,
 * screen-reader-visible status text next to it.
 */
export function AiThinking() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.row} role="status">
      <div className={styles.icons} aria-hidden="true">
        {INGREDIENTS.map((emoji, i) => (
          <motion.span
            key={emoji}
            className={styles.icon}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.25, 1, 0.25] }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }
            }
          >
            {emoji}
          </motion.span>
        ))}
      </div>
      <span className={styles.label}>FoodPadi is thinking…</span>
    </div>
  );
}
