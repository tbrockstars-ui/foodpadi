import Link from 'next/link';
import type { MealPlanView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../../lib/serverApi';
import { SavedPlansList } from './SavedPlansList';
import { AppShell } from '../../../components/AppShell';
import shellStyles from '../../app-shell.module.css';
import styles from '../plan.module.css';

/**
 * Every meal plan the user has generated (auto-saved), like Cook Today's
 * Saved recipes. Mobile counterpart: apps/mobile/src/screens/SavedPlansScreen.tsx.
 */
export default async function SavedPlansPage() {
  requireSession('/plan/saved');

  let plans: MealPlanView[] | null = null;
  try {
    plans = await serverFetch<MealPlanView[]>('/plan-ahead');
  } catch {
    // API unreachable — fall through to the "couldn't load" state below
    // rather than taking down the whole route (same precedent as /invite).
  }

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <h1 className={styles.title}>Saved plans</h1>
        {plans ? (
          <SavedPlansList initialPlans={plans} />
        ) : (
          <>
            <p className={styles.errorText}>Couldn&apos;t load your saved plans. Check your connection and try again.</p>
            <Link href="/plan/saved" className={styles.primaryButton} style={{ textDecoration: 'none', display: 'inline-block' }}>
              Try again
            </Link>
          </>
        )}
      </main>
    </AppShell>
  );
}
