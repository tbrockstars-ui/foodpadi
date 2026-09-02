'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './AiThinking.module.css';

const INGREDIENTS = ['🥕', '🍅', '🍗', '🍽️'];

/**
 * Replaces a plain "Loading…" wherever FoodPadi has something brief to wait
 * for (a /decide call, starting a guest session) — a short, cycling
 * ingredient sequence rather than a spinner, so waiting still feels like
 * part of the food experience. Purely decorative (aria-hidden); `label` is
 * the real, screen-reader-visible status text next to it.
 */
export function AiThinking({ label = 'FoodPadi is thinking…' }: { label?: string }) {
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
      <span className={styles.label}>{label}</span>
    </div>
  );
}
