import { redirect } from 'next/navigation';
import type { UserSummary } from '@foodpadi/shared';
import { ApiError, isAuthenticated, serverFetch } from '../../lib/serverApi';
import { getGuestState, hasGuestSession } from '../../lib/guestSession';
import { HomeHub } from '../HomeHub';
import { GuestAutoStart } from './GuestAutoStart';

/**
 * Dedicated guest entry point. This is what "Try FoodPadi" (nav, hero,
 * closing section — see TryFoodPadiButton.tsx) navigates to once the guest
 * session cookie is set, and it's also a valid, self-starting URL on its
 * own — a shared link or a bookmark that lands here with no session yet
 * still works, via GuestAutoStart below. `/` keeps its own existing
 * guest-continuity behaviour (a returning guest who lands on `/` directly
 * still sees their guest Home, not the marketing page) — this route is
 * additive, not a replacement for that.
 */
export default async function GuestPage() {
  if (isAuthenticated()) {
    // A real account should never be shown the guest experience — send them
    // to their actual Home instead (same disclaimer/onboarding gate as `/`).
    try {
      const me = await serverFetch<UserSummary>('/users/me');
      if (!me.disclaimerAcknowledgedAt) redirect('/disclaimer');
      if (!me.onboardingCompletedAt) redirect('/goal');
      redirect('/');
    } catch (e) {
      // A stale/invalid cookie (401/404) isn't really authenticated — fall
      // through to the guest checks below, same precedent as `/`.
      if (!(e instanceof ApiError && (e.status === 401 || e.status === 404))) {
        throw e;
      }
    }
  }

  if (hasGuestSession()) {
    return <HomeHub guest guestDisclaimerAcknowledged={getGuestState()?.disclaimerAcknowledged ?? false} />;
  }

  // No session yet — someone landed on /guest directly (a shared link, a
  // bookmark) rather than clicking "Try FoodPadi". Start one the same way
  // that button does, then land back here with it.
  return <GuestAutoStart />;
}
