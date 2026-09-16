import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { DealerView } from '@foodpadi/shared';
import { ApiError, requireSession, serverFetch } from '../../../lib/serverApi';
import { OnboardingWizard } from './OnboardingWizard';

export const metadata: Metadata = { title: 'Become a Food Dealer — FoodPadi', robots: { index: false } };
export const dynamic = 'force-dynamic';

// The web-only onboarding wizard (dealer brief §49). Requires sign-in — a
// dealer is an ordinary FoodPadi account (brief §51). If a listing already
// exists AND is past the draft stage, jump to the dashboard instead.
export default async function DealerOnboardingPage() {
  requireSession('/dealers/onboarding');

  let dealer: DealerView | null = null;
  try {
    dealer = await serverFetch<DealerView>('/dealers/me');
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) {
      if (e instanceof ApiError && e.status === 401) redirect('/login?next=%2Fdealers%2Fonboarding');
      throw e;
    }
  }

  if (dealer && dealer.listingStatus !== 'draft') {
    redirect('/dealers/dashboard');
  }

  return <OnboardingWizard initialDealer={dealer} />;
}
