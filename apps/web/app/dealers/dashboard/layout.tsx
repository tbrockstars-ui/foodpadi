import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { DealerView } from '@foodpadi/shared';
import { ApiError, requireSession, serverFetch } from '../../../lib/serverApi';
import { DealerDashboardChrome } from './DealerDashboardChrome';

// Shared chrome for every /dealers/dashboard/* page (dealer brief §4/§24). The
// dashboard is account-only; each page still fetches its own data (this only
// grabs the handful of fields the shell itself needs — name/status for the
// nav's account card).
export default async function DealerDashboardLayout({ children }: { children: React.ReactNode }) {
  requireSession('/dealers/dashboard');

  let dealer: DealerView | null = null;
  try {
    dealer = await serverFetch<DealerView>('/dealers/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) redirect('/dealers');
    if (e instanceof ApiError && e.status === 401) redirect('/login?next=%2Fdealers%2Fdashboard');
    // The API being briefly unreachable ("fetch failed": a restart, a cold
    // start, a DNS/IPv6 blip) or a genuine 5xx must never crash the whole
    // dashboard route with an unhandled error — same "fall through rather
    // than throw" precedent as app/profile, app/favorites, app/invite. This
    // page's own retry link re-runs this exact fetch.
  }

  if (!dealer) {
    return (
      <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', marginBottom: 16 }}>
          Couldn&apos;t load your dealer dashboard. Check your connection and try again.
        </p>
        <Link href="/dealers/dashboard" style={{ textDecoration: 'underline' }}>
          Try again
        </Link>
      </main>
    );
  }

  return (
    <DealerDashboardChrome
      dealer={{
        name: dealer.name,
        listingStatus: dealer.listingStatus,
        isLiveToCustomers: dealer.isLiveToCustomers,
      }}
    >
      {children}
    </DealerDashboardChrome>
  );
}
