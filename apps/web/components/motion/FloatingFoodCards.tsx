'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './FloatingFoodCards.module.css';

interface FoodCardSpec {
  emoji: string;
  label: string;
  top: string;
  left: string;
  rotate: number;
  delay: number;
  floatOffset: number;
}

// Positions match the reference hero mockup: four idea pills clustered in
// the upper half of the visual stage, with the glass "what should I eat
// tonight?" card sitting lower-right rather than dead centre.
const CARDS: FoodCardSpec[] = [
  { emoji: '🍝', label: 'Pasta', top: '2%', left: '8%', rotate: -6, delay: 0.5, floatOffset: 8 },
  { emoji: '🍛', label: 'Curry', top: '0%', left: '58%', rotate: 5, delay: 0.65, floatOffset: -10 },
  { emoji: '🥗', label: 'Fresh bowl', top: '40%', left: '2%', rotate: 4, delay: 0.8, floatOffset: -7 },
  { emoji: '🍲', label: 'Beans & rice', top: '38%', left: '56%', rotate: -3, delay: 0.95, floatOffset: 9 },
];

/**
 * The hero's animated visual: four food-idea pills float into their
 * scattered positions in the upper half of the stage, then a translucent
 * glass "what should I eat tonight?" card settles in lower-right — matching
 * the reference hero mockup rather than a single centred card. Every
 * animated value collapses to an instant, static layout under
 * prefers-reduced-motion — nothing here is required to understand the page.
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

      {CARDS.map((card) => (
        <motion.div
          key={card.label}
          className={styles.foodCard}
          style={{ top: card.top, left: card.left }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16, rotate: 0, scale: 0.85 }}
          animate={
            prefersReducedMotion
              ? { opacity: 1, rotate: card.rotate }
              : { opacity: 1, y: [16, 0, -card.floatOffset, 0], rotate: card.rotate, scale: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : {
                  opacity: { duration: 0.5, delay: card.delay },
                  scale: { duration: 0.5, delay: card.delay },
                  rotate: { duration: 0.5, delay: card.delay },
                  y: {
                    duration: 3.5,
                    delay: card.delay,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                  },
                }
          }
        >
          <span className={styles.foodCardEmoji} aria-hidden="true">
            {card.emoji}
          </span>
          <span className={styles.foodCardLabel}>{card.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
