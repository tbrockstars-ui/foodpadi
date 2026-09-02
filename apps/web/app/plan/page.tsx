import Link from 'next/link';
import type { MealPlanView } from '@foodpadi/shared';
import { ApiError, isGuest, requireSessionOrGuest, serverFetch } from '../../lib/serverApi';
import { getGuestState } from '../../lib/guestSession';
import { PlanGuestPreview } from './PlanGuestPreview';
import { PlanScopeForm } from './PlanScopeForm';
import { PlanView } from './PlanView';
import { BackLink } from '../../components/BackLink';
import { GuestDisclaimerGate } from '../../components/GuestDisclaimerGate';
import { Logo } from '../../components/Logo';
import shellStyles from '../app-shell.module.css';
import styles from './plan.module.css';

/**
 * Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx.
 *
 * Signed-in: `/plan` renders the user's active plan (draft or accepted) when
 * they have one, and the "How far ahead?" scope picker otherwise. `?new=1`
 * forces the picker even while a plan exists.
 *
 * Guest: an AI-free preview from the curated recipe pool (PlanGuestPreview) —
 * nothing saved. A real plan with reminders needs an account.
 */
export default async function PlanPage({ searchParams }: { searchParams: { new?: string } }) {
  requireSessionOrGuest('/plan');
  const guest = isGuest();

  let plan: MealPlanView | null = null;
  if (!guest) {
    try {
      plan = await serverFetch<MealPlanView | null>('/plan-ahead/current');
    } catch (e) {
      // A failed lookup shouldn't block the form — just fall through to it.
      if (!(e instanceof ApiError)) throw e;
    }
  }

  const showPlan = plan && !searchParams.new;

  return (
    <main className={shellStyles.container}>
      <Logo href="/" size={32} className={shellStyles.pageLogo} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)' }}>
        <BackLink href="/" label="Home" />
        {!guest ? (
          <Link href="/plan/saved" className={styles.itemActionText}>
            Saved plans
          </Link>
        ) : null}
      </div>

      {guest ? (
        <GuestDisclaimerGate acknowledged={getGuestState()?.disclaimerAcknowledged ?? false}>
          <PlanGuestPreview />
        </GuestDisclaimerGate>
      ) : showPlan ? (
        <PlanView plan={plan!} />
      ) : (
        <PlanScopeForm />
      )}
    </main>
  );
}
