import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import type { UserSummary } from '@foodpadi/shared';
import { ApiError, isAuthenticated, serverFetch } from '../lib/serverApi';
import { HeroContent } from './HeroContent';
import { ScrollReveal } from '../components/motion/ScrollReveal';
import { FloatingFoodCards } from '../components/motion/FloatingFoodCards';
import { HeroDecor } from '../components/motion/HeroDecor';
import { ChipRow } from '../components/motion/ChipRow';
import { FoodCarousel } from '../components/motion/FoodCarousel';
import { WeekStrip } from '../components/motion/WeekStrip';
import { HomeHub } from './HomeHub';
import styles from './page.module.css';

// Placeholder support address — swap for the real inbox once set up.
const SUPPORT_EMAIL = 'support@foodpadi.app';

const PRINCIPLES = [
  {
    title: 'A companion, not a chatbot',
    body: "FoodPadi adapts to how you actually eat — it doesn't demand a rigid plan and judge you for breaking it.",
  },
  {
    title: 'Food information, not medical advice',
    body: "We show ingredients and let you choose what to avoid. We don't diagnose allergies or make medical claims — that's a promise, not a disclaimer.",
  },
  {
    title: 'Built around your budget, not your calories',
    body: 'No weight-loss framing, no guilt scoring. Just help spending less and wasting less.',
  },
] as const;

interface HubAction {
  key: string;
  label: string;
  subtitle: string;
  icon?: string;
  href?: string;
  live: boolean;
  disabledTag?: string;
}

// "Understand Intent" branches from the FoodPadi decision-loop architecture
// (docs — the user's 2026-08-27 core-flow brief): FoodPadi should be one
// intent-first front door, not four equally-weighted modes the user picks
// between blind. The "Understand Context" / "FoodPadi Decides (3 options)"
// layer is <DecideFlow /> below (POST /decide, blending real Cook Today + Eat
// Now results into explained cook-it/get-it options) and now owns the "right
// now / I'm hungry" intent outright — so only Cooking (-> Cook Today) and
// Plan ahead (-> Plan Ahead) remain as direct-to-mode cards, for anyone who'd
// rather skip straight to a specific tool. Each is its own visual "journey"
// (IntentCard: real photo + accent colour + badge) rather than a flat card.

// Scan is mobile-only by design (docs/TECHNICAL_ARCHITECTURE.md §2.7) — it
// needs a camera, so it's never coming to web. "App only" says so directly
// instead of the generic "Soon", which would wrongly promise a web version.
// It's not one of the three intent branches, so it's a demoted secondary
// link below the primary row rather than a fourth equal-weight card.
const SECONDARY_ACTIONS: HubAction[] = [
  { key: 'scan', icon: '/scan-food.png', label: 'Scan Food', subtitle: 'Food, ingredients or receipt', live: false, disabledTag: 'App only' },
];

export default async function LandingPage() {
  if (isAuthenticated()) {
    // Same gate as mobile's RootNavigator: disclaimer is mandatory before
    // any feature, goal/preferences (OnboardingFlow) are skippable but must
    // at least be reached once. Mirrors user.disclaimerAcknowledgedAt /
    // onboardingCompletedAt from UserSummary exactly.
    try {
      const me = await serverFetch<UserSummary>('/users/me');
      if (!me.disclaimerAcknowledgedAt) redirect('/disclaimer');
      if (!me.onboardingCompletedAt) redirect('/goal');
      return <HomeHub />;
    } catch (e) {
      // A stale cookie (401 — expired/invalid token) or one pointing at a
      // deleted account (404 — the account no longer exists) both mean "not
      // really authenticated" here. A Server Component can't clear cookies
      // mid-render, so this just falls through to the landing page instead
      // of crashing the whole route; /login overwrites the cookie with a
      // fresh one regardless, so the stale value is otherwise harmless.
      if (!(e instanceof ApiError && (e.status === 401 || e.status === 404))) {
        throw e;
      }
    }
  }

  return (
    <>
      <section className={styles.hero}>
        <HeroDecor />

        <nav className={styles.heroNav} aria-label="Primary">
          <a className={styles.navLink} href="#how-it-works">
            How it works
          </a>
          <a className={styles.navLink} href="#about">
            About
          </a>
          <a className={styles.navLink} href="#contact">
            Contact
          </a>
          <Link className={styles.navLink} href="/login">
            Log in
          </Link>
          <a className={styles.navWaitlistButton} href="#waitlist-email">
            Join the waitlist
          </a>
        </nav>

        <div className={styles.heroGrid}>
          <div className={styles.heroLogoCol}>
            <Image
              src="/decor/logo.png"
              alt="FoodPadi — your instant meal companion"
              width={420}
              height={420}
              className={styles.heroLogoImg}
              priority
            />
          </div>

          <div className={styles.heroContent}>
            <HeroContent />
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <FloatingFoodCards />
          </div>
        </div>
      </section>

      <main className={styles.main}>
        <section id="how-it-works" className={styles.section}>
          <ScrollReveal>
            <h2 className={styles.sectionHeading}>FoodPadi gets to know what you like.</h2>
            <p className={styles.sectionSubtext}>
              Cuisines you love, how much time you&apos;ve got, who you&apos;re feeding — a few taps, not a form.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <ChipRow />
          </ScrollReveal>
        </section>

        <section className={styles.section}>
          <ScrollReveal>
            <h2 className={styles.sectionHeading}>Then it finds ideas for you.</h2>
            <p className={styles.sectionSubtext}>Real dishes from FoodPadi&apos;s food-idea catalogue, matched to what you asked for.</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <FoodCarousel />
          </ScrollReveal>
        </section>

        <section className={styles.section}>
          <ScrollReveal>
            <h2 className={styles.sectionHeading}>Then it helps you plan.</h2>
            <p className={styles.sectionSubtext}>Turn today&apos;s decision into a week that&apos;s actually easy to follow.</p>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <WeekStrip />
          </ScrollReveal>
        </section>

        <section id="about" className={`${styles.section} ${styles.sectionAlt}`}>
          <ScrollReveal>
            <h2 className={styles.sectionHeading}>
              Why <span className={styles.brandGreen}>FoodPadi</span> is different
            </h2>
          </ScrollReveal>
          <div className={styles.principles}>
            {PRINCIPLES.map((principle, i) => (
              <ScrollReveal key={principle.title} delay={i * 0.1}>
                <div className={styles.principleCard}>
                  <h3>{principle.title}</h3>
                  <p>{principle.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <ScrollReveal>
            <div className={styles.closingBlock}>
              <h2 className={styles.sectionHeading}>Your food. Your choices. Your plan.</h2>
              <p className={styles.sectionSubtext}>
                FoodPadi is still in development — join the waitlist above and we&apos;ll email you the
                moment it launches.
              </p>
            </div>
          </ScrollReveal>
        </section>

        <footer id="contact" className={styles.footer}>
          <Link href="/legal/disclaimer">Food & safety information</Link>
          <span className={styles.footerDivider}>·</span>
          <Link href="/legal/privacy">Privacy</Link>
          <span className={styles.footerDivider}>·</span>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
        </footer>
      </main>

      <a
        className={styles.supportFab}
        href={`mailto:${SUPPORT_EMAIL}`}
        aria-label="Contact support"
        title="Contact support"
      >
        💬
      </a>
    </>
  );
}
