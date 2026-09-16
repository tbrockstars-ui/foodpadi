'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TryFoodPadiButton } from './TryFoodPadiButton';
import { PlayStoreBadge } from '../components/PlayStoreBadge';
import { AppStoreBadge } from '../components/AppStoreBadge';
import styles from './page.module.css';

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

/**
 * The hero's text/CTA stack as a staggered on-load entrance — headline, then
 * supporting text, then the app-store badge row, then the button row, then
 * the sign-in hint (second design brief, 2026-09-16 — matches the reference
 * order: badges above buttons). "Ask FoodPadi" is the primary action (real
 * guest session → the working Decide/Cook Today experience, no wall); the
 * Play Store badge and "Join the iOS Waitlist" are the secondary,
 * platform-specific conversions (launch brief §4 — Android is the launch
 * platform, iOS visitors get a clear path instead of a dead end). The App
 * Store badge is currently a demo link (see AppStoreBadge.tsx) pending a
 * real iOS listing — it sits alongside "Join the iOS Waitlist" rather than
 * replacing it, per user instruction 2026-09-16. All CTAs are shown to every
 * visitor regardless of device — no user-agent sniffing. "Sign in" is folded
 * into the hint line rather than competing for equal visual weight with
 * "Ask FoodPadi" — it's for returning members, not new visitors deciding
 * whether to try FoodPadi at all. The generic "notify me about new features"
 * waitlist moved out of the hero entirely and still exists lower on the page
 * (§13 of the guest-mode brief) — a different, separate purpose from the iOS
 * waitlist above. A client component because framer-motion needs one; the
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
        Don&apos;t know what to eat?
        <br />
        <span className={styles.titleAccent}>Ask FoodPadi.</span>
      </motion.h1>
      <motion.p className={styles.subtext} variants={ITEM_VARIANTS} transition={transition(0.2)}>
        Tell FoodPadi what you&apos;re in the mood for, what you have, or how much time you&apos;ve
        got.
      </motion.p>
      <motion.div className={styles.storeBadgeRow} variants={ITEM_VARIANTS} transition={transition(0.26)}>
        <PlayStoreBadge />
        <AppStoreBadge />
      </motion.div>
      <motion.div className={styles.heroCtaRow} variants={ITEM_VARIANTS} transition={transition(0.32)}>
        <TryFoodPadiButton className={styles.tryNowButton}>Ask FoodPadi</TryFoodPadiButton>
        <Link className={styles.signInButton} href="/ios-waitlist">
          Join the iOS Waitlist
        </Link>
      </motion.div>
      <motion.p className={styles.tryNowHint} variants={ITEM_VARIANTS} transition={transition(0.38)}>
        No account needed to try it. Already have one?{' '}
        <Link href="/login" className={styles.heroSignInLink}>
          Sign in
        </Link>
        .
      </motion.p>
    </motion.div>
  );
}
