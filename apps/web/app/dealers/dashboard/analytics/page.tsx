import Link from 'next/link';
import type { DealerAnalyticsView } from '@foodpadi/shared';
import { ApiError, serverFetch } from '../../../../lib/serverApi';
import { loadOwnDealerOrOnboard } from '../dealerServer';
import { BarChart, EmptyState, Insight, MetricGrid, Panel, PageHeader } from '../ui';
import styles from '../../dealers.module.css';

export const dynamic = 'force-dynamic';

// Aggregate discovery analytics only — never customer identity or history
// (dealer brief §42/§43). The API aggregates a fixed trailing 30-day window;
// rather than a fake 7/90-day selector this page is honest about that window
// instead of pretending to filter data it doesn't have.
export default async function DealerAnalyticsPage() {
  const dealer = await loadOwnDealerOrOnboard();
  let a: DealerAnalyticsView | null = null;
  try {
    a = await serverFetch<DealerAnalyticsView>('/dealers/me/analytics');
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }

  const total = a
    ? a.searchAppearances +
      a.featuredImpressions +
      a.profileViews +
      a.websiteClicks +
      a.phoneClicks +
      a.directionClicks +
      a.orderClicks
    : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Understand how customers discover and interact with your FoodPadi presence."
        actions={<span className={`${styles.badge} ${styles.badgeNeutral}`}>Last {a?.rangeDays ?? 30} days</span>}
      />

      {!a || total === 0 ? (
        <>
          <EmptyState
            icon="📊"
            title="Your analytics will appear here"
            text="As customers discover and interact with your business on FoodPadi — searching, viewing your profile, clicking through to your website or ordering link — you'll see it here. Aggregated only; no customer details."
            action={
              <div className={styles.rowActions} style={{ justifyContent: 'center' }}>
                <Link href="/dealers/dashboard/profile" className={styles.ctaPrimary}>
                  Complete profile
                </Link>
                <Link href="/dealers/dashboard/products" className={styles.ctaSecondary}>
                  Add products
                </Link>
              </div>
            }
          />
          <MetricGrid
            metrics={[
              { label: 'Search appearances', value: null },
              { label: 'Profile views', value: null },
              { label: 'Website clicks', value: null },
              { label: 'Order-link clicks', value: null },
              { label: 'Phone clicks', value: null },
              { label: 'Directions clicks', value: null },
              { label: 'Featured impressions', value: null },
            ]}
          />
        </>
      ) : (
        <>
          <MetricGrid
            metrics={[
              { label: 'Search appearances', value: a.searchAppearances },
              { label: 'Profile views', value: a.profileViews },
              { label: 'Website clicks', value: a.websiteClicks },
              { label: 'Order-link clicks', value: a.orderClicks },
              { label: 'Phone clicks', value: a.phoneClicks },
              { label: 'Directions clicks', value: a.directionClicks },
              { label: 'Featured impressions', value: a.featuredImpressions },
            ]}
          />

          <Insight text={buildInsight(a, dealer.products)} />

          <div className={styles.panelGrid2}>
            <Panel title="Customer actions" subtitle="What people did after finding your listing.">
              <BarChart
                rows={[
                  { label: 'Profile views', value: a.profileViews },
                  { label: 'Website clicks', value: a.websiteClicks },
                  { label: 'Phone clicks', value: a.phoneClicks },
                  { label: 'Directions', value: a.directionClicks },
                  { label: 'Order clicks', value: a.orderClicks },
                ]}
              />
            </Panel>

            <Panel title="Top search terms" subtitle="What customers searched when you appeared.">
              {a.topSearches.length ? (
                <div className={styles.tableWrap} style={{ border: 0 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Search term</th>
                        <th className={styles.numeric}>Appearances</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.topSearches.map((s) => (
                        <tr key={s.query}>
                          <td>{s.query}</td>
                          <td className={styles.numeric}>{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.itemMeta}>No search-term data yet.</p>
              )}
            </Panel>
          </div>

          <Panel title="Your products" subtitle="Per-product view/click analytics are coming soon.">
            {dealer.products.length ? (
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
                    {dealer.products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.category ?? '—'}</td>
                        <td>{p.priceText ?? '—'}</td>
                        <td>{p.available ? 'Available' : 'Unavailable'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.itemMeta}>No products listed yet.</p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function buildInsight(a: DealerAnalyticsView, products: { name: string; available: boolean }[]): string {
  const parts: string[] = [];
  if (a.profileViews > 0) parts.push(`your profile was viewed ${a.profileViews.toLocaleString()} times`);
  if (a.searchAppearances > 0) parts.push(`you appeared in FoodPadi search ${a.searchAppearances.toLocaleString()} times`);
  const clicks = a.websiteClicks + a.orderClicks + a.phoneClicks + a.directionClicks;
  if (clicks > 0) parts.push(`customers took ${clicks.toLocaleString()} actions (website, order, call or directions)`);
  if (a.topSearches[0]) parts.push(`most often for "${a.topSearches[0].query}"`);

  if (parts.length === 0) {
    return products.length
      ? 'No customer interactions yet in the last 30 days. Once your listing starts appearing in FoodPadi search, activity will show up here.'
      : 'Add products and complete your profile to start appearing in FoodPadi search.';
  }
  return `In the last ${a.rangeDays} days, ${parts.join(', ')}.`;
}
