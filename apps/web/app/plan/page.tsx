import Link from 'next/link';
import type { MealPlanView } from '@foodpadi/shared';
import { requireSession, serverFetch } from '../../lib/serverApi';
import { PlanScopeForm } from './PlanScopeForm';
import { PlanView } from './PlanView';
import shellStyles from '../app-shell.module.css';

/**
 * Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx. Requires a
 * real account — matches mobile's own behaviour exactly (HomeScreen blocks
 * guests from Plan Ahead immediately, never shows a stub screen for it).
 */
export default async function PlanPage() {
  requireSession('/plan');
  const plan = await serverFetch<MealPlanView | null>('/plan-ahead/current');

  return (
    <main className={shellStyles.container}>
      <Link href="/" className={shellStyles.backLink}>
        ‹ Home
      </Link>
      {plan ? <PlanView plan={plan} /> : <PlanScopeForm />}
    </main>
  );
}
