import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { UserSummary } from '@foodpadi/shared';
import { ApiError, isAuthenticated, serverFetch } from '../lib/serverApi';
import { Card } from '../components/Card';
import styles from './page.module.css';
import homeStyles from './home.module.css';

// Placeholder store links — swap for real App Store/Play Store URLs once listed.
const APP_STORE_URL = '#';
const PLAY_STORE_URL = '#';

const MODES = [
  {
    emoji: '🍽️',
    title: 'Eat Now',
    body: "I'm hungry. What can I eat right now?",
  },
  {
    emoji: '🍳',
    title: 'Cook Today',
    body: "What can I cook with what I've got?",
  },
  {
    emoji: '🗓️',
    title: 'Plan Ahead',
    body: 'Help me plan my meals — flexibly.',
  },
] as const;

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

// v1 web slice ships Plan Ahead only — see docs/TECHNICAL_ARCHITECTURE.md
// §2.7. The rest mirror mobile's HomeScreen "Soon" treatment until they land.
const HUB_ACTIONS = [
  { key: 'plan-ahead', label: 'Plan ahead', subtitle: 'Plan your meals', href: '/plan', live: true },
  { key: 'eat-now', label: 'Eat now', subtitle: 'Find something to eat', href: '/eat-now', live: true },
  { key: 'cook-today', label: 'Cook today', subtitle: 'Choose something to cook', href: '/cook-today', live: true },
  { key: 'scan', label: 'Scan', subtitle: 'Food, ingredients or receipt', live: false },
] as const;

function HomeHub() {
  return (
    <main className={homeStyles.container}>
      <div className={homeStyles.header}>
        <h1 className={homeStyles.heading}>What do you need today?</h1>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className={homeStyles.logoutLink}>
            Log out
          </button>
        </form>
      </div>

      <div className={homeStyles.grid}>
        {HUB_ACTIONS.map((action) =>
          action.live ? (
            <Card key={action.key} href={action.href} className={homeStyles.actionCard}>
              <p className={homeStyles.actionLabel}>{action.label}</p>
              <p className={homeStyles.actionSubtitle}>{action.subtitle}</p>
            </Card>
          ) : (
            <div key={action.key} className={homeStyles.actionCardDisabled}>
              <p className={homeStyles.actionLabelDisabled}>{action.label}</p>
              <p className={homeStyles.actionSubtitle}>{action.subtitle}</p>
              <span className={homeStyles.soonTag}>Soon</span>
            </div>
          ),
        )}
      </div>
    </main>
  );
}

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
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>UK · in development</p>
            <h1 className={styles.title}>Get the free FoodPadi app</h1>
            <p className={styles.subtext}>
              Your food companion that plans with you, not for you. Eat Now, Cook Today, or Plan
              Ahead — FoodPadi adapts to real life instead of asking you to plan your life around a
              meal plan.
            </p>

            <div className={styles.storeLinks}>
              <a className={styles.storeButton} href={APP_STORE_URL}>
                Download on the App Store
              </a>
              <a className={`${styles.storeButton} ${styles.storeButtonSecondary}`} href={PLAY_STORE_URL}>
                Get it on Google Play
              </a>
            </div>
            <Link className={styles.loginLink} href="/login">
              Already have an account? Log in
            </Link>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <svg viewBox="0 0 320 320" className={styles.heroSvg} xmlns="http://www.w3.org/2000/svg">
              <circle cx="160" cy="160" r="150" fill="rgba(255,255,255,0.08)" />
              <circle cx="120" cy="120" r="90" fill="rgba(255,255,255,0.10)" />
              <circle cx="210" cy="210" r="60" fill="rgba(255,255,255,0.14)" />
            </svg>
            <span className={styles.heroEmoji}>🥗</span>
          </div>
        </div>
      </section>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Three ways to eat</h2>
          <p className={styles.sectionSubtext}>Pick whichever fits the moment — none of them are mandatory.</p>
          <div className={styles.modes}>
            {MODES.map((mode) => (
              <div key={mode.title} className={styles.modeCard}>
                <span className={styles.modeEmoji} aria-hidden="true">
                  {mode.emoji}
                </span>
                <h3>{mode.title}</h3>
                <p>{mode.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <h2 className={styles.sectionHeading}>Why FoodPadi is different</h2>
          <div className={styles.principles}>
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className={styles.principleCard}>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <Link href="/legal/disclaimer">Food & safety information</Link>
          <span className={styles.footerDivider}>·</span>
          <Link href="/legal/privacy">Privacy</Link>
        </footer>
      </main>
    </>
  );
}
