'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { WaitlistForm } from './WaitlistForm';
import styles from './page.module.css';

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

/**
 * The hero's text/CTA stack as a staggered on-load entrance — headline,
 * then supporting text, then the waitlist CTA, then the login link (brief
 * section 8, steps 1-3). A client component because framer-motion needs one;
 * the parent page (page.tsx) stays a Server Component around it.
 */
export function HeroContent() {
  const prefersReducedMotion = useReducedMotion();
  const transition = (delay: number) => ({
    duration: prefersReducedMotion ? 0.01 : 0.55,
    delay: prefersReducedMotion ? 0 : delay,
    ease: [0.21, 0.47, 0.32, 0.98] as const,
  });

  return (
    <motion.div initial="hidden" animate="visible">
      <motion.h1 className={styles.title} variants={ITEM_VARIANTS} transition={transition(0)}>
        Food that fits your life.
      </motion.h1>
      <motion.p className={styles.subtext} variants={ITEM_VARIANTS} transition={transition(0.2)}>
        Discover food, decide what to eat and plan meals with your personal AI food companion —
        FoodPadi adapts to real life instead of asking you to plan your life around a meal plan.
      </motion.p>
      <motion.div variants={ITEM_VARIANTS} transition={transition(0.3)}>
        <WaitlistForm />
      </motion.div>
      <motion.div variants={ITEM_VARIANTS} transition={transition(0.38)}>
        <Link className={styles.loginLink} href="/login">
          Already have an account? Log in
        </Link>
      </motion.div>
    </motion.div>
  );
}
