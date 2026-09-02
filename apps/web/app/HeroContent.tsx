'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TryFoodPadiButton } from './TryFoodPadiButton';
import styles from './page.module.css';

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

/**
 * The hero's text/CTA stack as a staggered on-load entrance — headline, then
 * supporting text, then the CTA row. "Try FoodPadi" is the primary action
 * (real guest session → the working Decide/Cook Today experience, no wall);
 * "Sign in" is secondary. The waitlist moved out of the hero entirely — it
 * was outranking a CTA that leads to an actually-working product, and its
 * own "we'll email you when FoodPadi launches" copy directly contradicted a
 * visitor being one click from using it. It still exists, just lower on the
 * page (§13 of the guest-mode brief: don't let it compete with the primary
 * "try it" action). A client component because framer-motion needs one; the
 * parent page (page.tsx) stays a Server Component around it.
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
        What should I eat?
      </motion.h1>
      <motion.p className={styles.subtext} variants={ITEM_VARIANTS} transition={transition(0.2)}>
        FoodPadi helps you decide what to eat, whether you want something quick, affordable,
        filling, familiar or completely different.
      </motion.p>
      <motion.div className={styles.heroCtaRow} variants={ITEM_VARIANTS} transition={transition(0.28)}>
        <TryFoodPadiButton className={styles.tryNowButton}>Try FoodPadi</TryFoodPadiButton>
        <Link className={styles.signInButton} href="/login">
          Sign in
        </Link>
      </motion.div>
      <motion.p className={styles.tryNowHint} variants={ITEM_VARIANTS} transition={transition(0.34)}>
        No account needed to try it.
      </motion.p>
    </motion.div>
  );
}
