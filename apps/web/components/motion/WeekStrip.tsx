'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './WeekStrip.module.css';

const DAYS = [
  { day: 'MON', breakfast: '🍳', lunch: '🥗', dinner: '🍗' },
  { day: 'TUE', breakfast: '🥐', lunch: '🍜', dinner: '🍛' },
  { day: 'WED', breakfast: '🍳', lunch: '🥪', dinner: '🍝' },
  { day: 'THU', breakfast: '🥣', lunch: '🥗', dinner: '🌮' },
  { day: 'FRI', breakfast: '🥐', lunch: '🍜', dinner: '🍕' },
];

const columnVariants = (prefersReducedMotion: boolean) => ({
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion
      ? { duration: 0.01 }
      : { duration: 0.4, delay: i * 0.08, ease: 'easeOut' as const },
  }),
});

/**
 * Lightweight, non-interactive preview of Plan Ahead's weekly shape for the
 * landing page's scroll story — the real, editable planner lives at /plan
 * once signed in; this is illustration, not a functional preview.
 */
export function WeekStrip() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.strip}>
      {DAYS.map((d, i) => (
        <motion.div
          key={d.day}
          className={styles.column}
          custom={i}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={columnVariants(!!prefersReducedMotion)}
        >
          <p className={styles.dayLabel}>{d.day}</p>
          <span className={styles.mealRow}>{d.breakfast} Breakfast</span>
          <span className={styles.mealRow}>{d.lunch} Lunch</span>
          <span className={styles.mealRow}>{d.dinner} Dinner</span>
        </motion.div>
      ))}
    </div>
  );
}
