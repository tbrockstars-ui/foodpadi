import Link from 'next/link';
import type { MealPlanView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../lib/serverApi';
import { PlanScopeForm } from './PlanScopeForm';
import { PlanView } from './PlanView';
import { BackLink } from '../../components/BackLink';
import shellStyles from '../app-shell.module.css';
import styles from './plan.module.css';

/**
 * Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx. Requires a
 * real account — matches mobile's own behaviour exactly (HomeScreen blocks
 * guests from Plan Ahead immediately, never shows a stub screen for it).
 */
export default async function PlanPage({ searchParams }: { searchParams: { new?: string } }) {
  requireSession('/plan');
  const plan = await serverFetch<MealPlanView | null>('/plan-ahead/current');

  // ?new=1 forces the scope picker even when a current plan exists — "start a
  // new plan" from PlanView. The old plan stays saved (Saved plans list).
  const startNew = searchParams.new === '1';

  return (
    <main className={shellStyles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)' }}>
        <BackLink href="/" label="Home" />
        <Link href="/plan/saved" className={styles.itemActionText}>
          Saved plans
        </Link>
      </div>
      {plan && !startNew ? <PlanView plan={plan} /> : <PlanScopeForm />}
    </main>
  );
}
