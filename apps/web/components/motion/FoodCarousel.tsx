'use client';

import { motion, useReducedMotion } from 'framer-motion';
import styles from './FoodCarousel.module.css';

interface CarouselItem {
  emoji: string;
  title: string;
  cuisine: string;
}

// Real titles pulled from apps/api/.../eat-now-catalog.ts — illustrative on
// this marketing page (not a live search), but not invented dishes either.
const ITEMS: CarouselItem[] = [
  { emoji: '🍛', title: 'Jollof rice with chicken', cuisine: 'Nigerian & West African' },
  { emoji: '🥙', title: 'Chicken shawarma wrap', cuisine: 'Middle Eastern' },
  { emoji: '🍝', title: 'Spaghetti bolognese', cuisine: 'Italian' },
  { emoji: '🍣', title: 'Sushi box', cuisine: 'Japanese' },
  { emoji: '🍟', title: 'Fish and chips', cuisine: 'British' },
  { emoji: '🍜', title: 'Thai green curry', cuisine: 'Thai' },
  { emoji: '🌮', title: 'Tacos', cuisine: 'Mexican' },
  { emoji: '🍲', title: 'Egusi soup with pounded yam', cuisine: 'Nigerian & West African' },
];

const cardVariants = (prefersReducedMotion: boolean) => ({
  hidden: { opacity: 0, x: prefersReducedMotion ? 0 : 32 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: prefersReducedMotion
      ? { duration: 0.01 }
      : { duration: 0.45, delay: i * 0.06, ease: 'easeOut' as const },
  }),
});

/**
 * Horizontal food-idea strip for the landing page's scroll story — real
 * dish names from eat-now-catalog.ts, not a live search. Hover lift + shadow
 * only (section 10's card micro-interaction spec); no click target, since
 * this is a marketing illustration, not the actual Eat Now results list.
 */
export function FoodCarousel() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={styles.track}>
      {ITEMS.map((item, i) => (
        <motion.div
          key={item.title}
          className={styles.card}
          custom={i}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={cardVariants(!!prefersReducedMotion)}
          whileHover={prefersReducedMotion ? undefined : { y: -6, boxShadow: '0 16px 32px rgba(20, 21, 15, 0.16)' }}
          transition={{ type: 'tween', duration: 0.18 }}
        >
          <span className={styles.emoji} aria-hidden="true">
            {item.emoji}
          </span>
          <p className={styles.title}>{item.title}</p>
          <p className={styles.cuisine}>{item.cuisine}</p>
        </motion.div>
      ))}
    </div>
  );
}
