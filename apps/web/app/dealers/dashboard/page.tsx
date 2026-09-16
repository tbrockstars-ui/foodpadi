import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { DealerAnalyticsView, DealerView } from '@foodpadi/shared';
import { DEALER_FEATURED_MIN_COMPLETENESS } from '@foodpadi/shared';
import { ApiError, serverFetch } from '../../../lib/serverApi';
import { DashboardActivation } from './DashboardActivation';
import { ApplicationStatusPanel } from './ApplicationStatusPanel';
import { EmptyState, MetricGrid, Panel, PageHeader, ScoreRing, relativeTime } from './ui';
import styles from '../dealers.module.css';

export const dynamic = 'force-dynamic';

// `failed: true` means "couldn't tell" (the API was unreachable, or errored
// unexpectedly) — distinct from a confirmed-absent 404/400. Collapsing both
// into a bare `null` would either crash the whole page on a network blip
// (the old behaviour) or, worse, wrongly redirect an existing dealer to
// onboarding just because one fetch hiccuped.
async function safe<T>(path: string): Promise<{ data: T | null; failed: boolean }> {
  try {
    return { data: await serverFetch<T>(path), failed: false };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return { data: null, failed: false };
    return { data: null, failed: true };
  }
}

export default async function DealerOverviewPage() {
  const dealerResult = await safe<DealerView>('/dealers/me');
  if (dealerResult.failed) {
    return (
      <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--danger)', marginBottom: 16 }}>
          Couldn&apos;t load your dashboard. Check your connection and try again.
        </p>
        <Link href="/dealers/dashboard" style={{ textDecoration: 'underline' }}>
          Try again
        </Link>
      </main>
    );
  }
  const dealer = dealerResult.data;
  if (!dealer) redirect('/dealers/onboarding');

  const { data: analytics } = await safe<DealerAnalyticsView>('/dealers/me/analytics');
  // Analytics is supplementary to this page — a failed fetch degrades to the
  // existing "no data yet" empty state rather than blocking the whole overview
  // (same posture the 404/400 case already had).

  const hasActivity = !!analytics && (analytics.searchAppearances > 0 || analytics.profileViews > 0);
  // Once a dealer has ever gone live, the discovery-metrics teaser is useful
  // even while lapsed (`expired`); before that, ApplicationStatusPanel below
  // already explains exactly where they stand, so skip the redundant "No
  // activity yet" block for pending/approved/rejected/changes_requested/
  // suspended dealers.
  const everLive = dealer.activatedAt != null;
  const firstName = dealer.name.split(' ')[0] || dealer.name;

  const activity: { label: string; at: string }[] = [
    dealer.createdAt ? { label: 'Profile created', at: dealer.createdAt } : null,
    dealer.submittedAt ? { label: 'Submitted for review', at: dealer.submittedAt } : null,
    dealer.activatedAt ? { label: 'Listing went live', at: dealer.activatedAt } : null,
  ].filter((x): x is { label: string; at: string } => !!x)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <>
      <Suspense fallback={null}>
        <DashboardActivation />
      </Suspense>

      <PageHeader
        kicker="Overview"
        title={`Good to see you, ${firstName}`}
        description="Here's how your FoodPadi presence is performing."
      />

      <Suspense fallback={null}>
        <ApplicationStatusPanel dealer={dealer} />
      </Suspense>

      {everLive ? (
        hasActivity && analytics ? (
          <MetricGrid
            metrics={[
              { label: 'Search appearances', value: analytics.searchAppearances },
              { label: 'Profile views', value: analytics.profileViews },
              { label: 'Website clicks', value: analytics.websiteClicks },
              { label: 'Order-link clicks', value: analytics.orderClicks },
            ]}
          />
        ) : (
          <EmptyState
            icon="📈"
            title="No activity yet"
            text="Search appearances, profile views and clicks will start appearing here once customers find your listing on FoodPadi."
          />
        )
      ) : null}

      <div className={styles.panelGrid2}>
        <Panel title="Profile completeness" subtitle="A more complete profile ranks better in FoodPadi search.">
          <div className={styles.scoreRow}>
            <ScoreRing pct={dealer.profileCompleteness} />
            <div>
              <p className={styles.itemMeta} style={{ margin: 0 }}>
                {dealer.profileCompleteness >= DEALER_FEATURED_MIN_COMPLETENESS
                  ? 'Eligible for Featured placement.'
                  : `Reach ${DEALER_FEATURED_MIN_COMPLETENESS}% to unlock Featured eligibility.`}
              </p>
              <Link href="/dealers/dashboard/profile" className={styles.ctaPrimary} style={{ marginTop: 10 }}>
                Complete profile
              </Link>
            </div>
          </div>
        </Panel>

        <Panel title="Search visibility" subtitle="How discoverable your business is right now.">
          <div className={styles.scoreRow}>
            <ScoreRing pct={dealer.isLiveToCustomers ? Math.max(dealer.profileCompleteness, 40) : 0} />
            <div>
              <p className={styles.itemMeta} style={{ margin: 0 }}>
                {dealer.isLiveToCustomers
                  ? 'Your business is currently appearing in FoodPadi search.'
                  : 'Not yet appearing in FoodPadi search — go live to become discoverable.'}
              </p>
              <Link href="/dealers/dashboard/visibility" className={styles.ctaSecondary} style={{ marginTop: 10 }}>
                Improve visibility
              </Link>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Your products" subtitle={`${dealer.products.length} listed`}>
        {dealer.products.length === 0 ? (
          <EmptyState
            icon="🍲"
            title="No products yet"
            text="Add what you sell so customers searching FoodPadi can find it."
            action={
              <Link href="/dealers/dashboard/products" className={styles.ctaPrimary}>
                Add your first product
              </Link>
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {dealer.products.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.category ?? '—'}</td>
                    <td>{p.priceText ?? '—'}</td>
                    <td>
                      {p.available ? (
                        <span className={`${styles.badge} ${styles.badgeLime}`}>
                          <span className={styles.badgeDot} />
                          Available
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                          <span className={styles.badgeDot} />
                          Unavailable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Recent activity">
        {activity.length === 0 ? (
          <p className={styles.itemMeta}>No activity yet. Activity like submitting your profile or going live will show up here.</p>
        ) : (
          <ul className={styles.activityList}>
            {activity.map((a) => (
              <li key={a.label} className={styles.activityRow}>
                <span className={styles.activityDot} aria-hidden />
                <span className={styles.activityLabel}>{a.label}</span>
                <span className={styles.activityTime}>{relativeTime(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
