import { redirect } from 'next/navigation';
import type { DealerView } from '@foodpadi/shared';
import { ApiError, serverFetch } from '../../../lib/serverApi';

// Shared by the dashboard subpages: load the caller's dealer, or bounce to the
// onboarding wizard when they don't have one yet.
export async function loadOwnDealerOrOnboard(): Promise<DealerView> {
  try {
    return await serverFetch<DealerView>('/dealers/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) redirect('/dealers/onboarding');
    if (e instanceof ApiError && e.status === 401) redirect('/login?next=%2Fdealers%2Fdashboard');
    throw e;
  }
}
