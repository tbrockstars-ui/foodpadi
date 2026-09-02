import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { MealPlanView } from '@foodpadi/shared';
import { ApiError, requireSession, serverFetch } from '../../../lib/serverApi';
import { PlanView } from '../PlanView';
import { BackLink } from '../../../components/BackLink';
import { Logo } from '../../../components/Logo';
import shellStyles from '../../app-shell.module.css';
import styles from '../plan.module.css';

/**
 * The generated plan (days, per-day replace, shopping list). Split out of
 * /plan so that route can stay the "How far ahead?" scope picker. No plan
 * yet -> back to the picker.
 */
export default async function CurrentPlanPage() {
  requireSession('/plan/current');

  let plan: MealPlanView | null = null;
  try {
    plan = await serverFetch<MealPlanView | null>('/plan-ahead/current');
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }

  if (!plan) redirect('/plan');

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)' }}>
        <BackLink href="/plan" label="Plan ahead" />
        <Link href="/plan/saved" className={styles.itemActionText}>
          Saved plans
        </Link>
      </div>
      <PlanView plan={plan} />
    </main>
  );
}
