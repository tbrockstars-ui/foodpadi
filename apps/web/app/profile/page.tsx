import Link from 'next/link';
import type {
  AvoidedIngredientItem,
  FoodGoalItem,
  FoodPreferenceItem,
  UserSummary,
} from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../lib/serverApi';
import { BackLink } from '../../components/BackLink';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';
import styles from './profile.module.css';
import { GoalsSection } from './GoalsSection';
import { CuisinesSection } from './CuisinesSection';
import { AvoidedIngredientsSection } from './AvoidedIngredientsSection';
import { PrivacySection } from './PrivacySection';

/** Web counterpart to apps/mobile/src/screens/ProfileScreen.tsx — lets a
 * user revisit goals/preferences/avoided ingredients after onboarding,
 * rather than only ever setting them once. */
export default async function ProfilePage() {
  requireSession('/profile');

  const [me, preferences, avoided, goalsResponse] = await Promise.all([
    serverFetch<UserSummary>('/users/me'),
    serverFetch<FoodPreferenceItem[]>('/users/me/preferences'),
    serverFetch<AvoidedIngredientItem[]>('/users/me/avoided-ingredients'),
    serverFetch<{ goals: FoodGoalItem[] }>('/users/me/goals'),
  ]);

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <BackLink href="/" label="Home" />

      <h1 className={styles.title}>Profile</h1>
      <p className={styles.email}>{me.email}</p>

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
        <GoalsSection initialGoals={goalsResponse.goals} />
      </div>

      <h2 className={styles.sectionHeading}>Favourite cuisines</h2>
      <div className={styles.section}>
        <CuisinesSection initialPreferences={preferences} />
      </div>

      <h2 className={styles.sectionHeading}>Foods I choose to avoid</h2>
      <div className={styles.section}>
        <AvoidedIngredientsSection initialAvoided={avoided} />
      </div>

      <h2 className={styles.sectionHeading}>Privacy</h2>
      <div className={styles.section}>
        <PrivacySection />
      </div>
    </main>
  );
}
