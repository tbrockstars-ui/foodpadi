import Link from 'next/link';
import type {
  AvoidedIngredientItem,
  FoodGoalItem,
  FoodPreferenceItem,
  UserSummary,
} from '@foodpadi/shared';
import { redirectToLoginIfUnauthorized, requireSession, serverFetch } from '../../lib/serverApi';
import { AppShell } from '../../components/AppShell';
import shellStyles from '../app-shell.module.css';
import styles from './profile.module.css';
import { GoalsSection } from './GoalsSection';
import { CuisinesSection } from './CuisinesSection';
import { AvoidedIngredientsSection } from './AvoidedIngredientsSection';
import { PrivacySection } from './PrivacySection';

interface ProfileData {
  me: UserSummary;
  preferences: FoodPreferenceItem[];
  avoided: AvoidedIngredientItem[];
  goals: FoodGoalItem[];
}

/** Web counterpart to apps/mobile/src/screens/ProfileScreen.tsx — lets a
 * user revisit goals/preferences/avoided ingredients after onboarding,
 * rather than only ever setting them once. */
export default async function ProfilePage() {
  requireSession('/profile');

  let data: ProfileData | null = null;
  try {
    const [me, preferences, avoided, goalsResponse] = await Promise.all([
      serverFetch<UserSummary>('/users/me'),
      serverFetch<FoodPreferenceItem[]>('/users/me/preferences'),
      serverFetch<AvoidedIngredientItem[]>('/users/me/avoided-ingredients'),
      serverFetch<{ goals: FoodGoalItem[] }>('/users/me/goals'),
    ]);
    data = { me, preferences, avoided, goals: goalsResponse.goals };
  } catch (e) {
    // Stale session (access token expired) — re-auth via login rather than
    // dead-ending on the "couldn't load" error below, which a guest with a
    // leftover access cookie can otherwise never get past.
    redirectToLoginIfUnauthorized(e, '/profile');
    // Any other error (API genuinely unreachable) — fall through to the
    // "couldn't load" state below rather than taking down the whole route
    // with an unhandled "fetch failed" (same precedent as /invite).
  }

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <h1 className={styles.title}>Profile</h1>

        {!data ? (
          <>
            <p className={styles.errorText}>
              Couldn&apos;t load your profile. Check your connection and try again.
            </p>
            <Link href="/profile" className={styles.secondaryButton} style={{ textDecoration: 'none' }}>
              Try again
            </Link>
          </>
        ) : (
          <>
            <p className={styles.email}>{data.me.email}</p>

            <h2 className={styles.sectionHeading}>Recipes &amp; plans</h2>
            <div className={styles.section} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
              <Link href="/cook-today/saved" className={styles.secondaryButton} style={{ textDecoration: 'none' }}>
                View saved recipes
              </Link>
              <Link href="/plan/saved" className={styles.secondaryButton} style={{ textDecoration: 'none' }}>
                View saved plans
              </Link>
            </div>

            <h2 className={styles.sectionHeading}>Food & lifestyle goals</h2>
            <div className={styles.section}>
              <GoalsSection initialGoals={data.goals} />
            </div>

            <h2 className={styles.sectionHeading}>Favourite cuisines</h2>
            <div className={styles.section}>
              <CuisinesSection initialPreferences={data.preferences} />
            </div>

            {/* id target for SettingsMenu's "Foods to avoid" shortcut
                (/profile#avoided-foods) — scroll-margin-top keeps the heading
                clear of the viewport edge on jump instead of landing flush
                against it. */}
            <h2 id="avoided-foods" className={`${styles.sectionHeading} ${styles.anchorTarget}`}>
              Foods I choose to avoid
            </h2>
            <div className={styles.section}>
              <AvoidedIngredientsSection initialAvoided={data.avoided} />
            </div>

            <h2 className={styles.sectionHeading}>Privacy</h2>
            <div className={styles.section}>
              <PrivacySection />
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
