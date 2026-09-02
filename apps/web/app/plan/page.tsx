import Link from 'next/link';
import type { MealPlanView } from '@foodpadi/shared';
import { ApiError, requireSession, serverFetch } from '../../lib/serverApi';
import { PlanScopeForm } from './PlanScopeForm';
import { BackLink } from '../../components/BackLink';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';
import styles from './plan.module.css';

/**
 * Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx. Requires a
 * real account — matches mobile's own behaviour exactly (HomeScreen blocks
 * guests from Plan Ahead immediately, never shows a stub screen for it).
 *
 * /plan is always the "How far ahead?" scope picker. A plan that's already
 * been generated lives at /plan/current, linked from here when one exists.
 */
export default async function PlanPage() {
  requireSession('/plan');

  let hasCurrentPlan = false;
  try {
    const plan = await serverFetch<MealPlanView | null>('/plan-ahead/current');
    hasCurrentPlan = !!plan;
  } catch (e) {
    // A failed lookup shouldn't block the form — just don't show the link.
    if (!(e instanceof ApiError)) throw e;
  }

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)' }}>
        <BackLink href="/" label="Home" />
        <Link href="/plan/saved" className={styles.itemActionText}>
          Saved plans
        </Link>
      </div>

      {hasCurrentPlan ? (
        <p className={styles.currentPlanNote}>
          You have a plan in progress.{' '}
          <Link href="/plan/current" className={styles.itemActionText}>
            View it
          </Link>
        </p>
      ) : null}

      <PlanScopeForm />
    </main>
  );
}
