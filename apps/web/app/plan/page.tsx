import Link from 'next/link';
import type { MealPlanView, UserSummary } from '@foodpadi/shared';
import { ApiError, isGuest, requireSessionOrGuest, serverFetch } from '../../lib/serverApi';
import { getGuestState } from '../../lib/guestSession';
import { PlanGuestPreview } from './PlanGuestPreview';
import { PlanScopeForm } from './PlanScopeForm';
import { PlanView } from './PlanView';
import { AppShell } from '../../components/AppShell';
import { GuestDisclaimerGate } from '../../components/GuestDisclaimerGate';
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
  // Only a 'paid' entitlement unlocks the "This week" / "More options" scopes
  // below (user instruction 2026-09-12) — trial and a lapsed/guest account
  // stay capped at "Just tomorrow". Best-effort: a failed lookup falls back
  // to the more restrictive `false`, never silently granting the gated scopes.
  let isPremium = false;
  if (!guest) {
    try {
      plan = await serverFetch<MealPlanView | null>('/plan-ahead/current');
    } catch (e) {
      // A failed lookup shouldn't block the form — just fall through to it.
      if (!(e instanceof ApiError)) throw e;
    }
    try {
      const me = await serverFetch<UserSummary>('/users/me');
      isPremium = me.entitlement === 'paid';
    } catch (e) {
      if (e instanceof ApiError && e.status >= 500) throw e;
    }
  }

  const showPlan = plan && !searchParams.new;

  return (
    <AppShell guest={guest}>
      <main className={shellStyles.shellPage}>
        {!guest ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
            <Link href="/plan/saved" className={styles.itemActionText}>
              Saved plans
            </Link>
          </div>
        ) : null}

        {guest ? (
          <GuestDisclaimerGate acknowledged={getGuestState()?.disclaimerAcknowledged ?? false}>
            <PlanGuestPreview />
          </GuestDisclaimerGate>
        ) : showPlan ? (
          <PlanView plan={plan!} />
        ) : (
          <PlanScopeForm isPremium={isPremium} />
        )}
      </main>
    </AppShell>
  );
}
