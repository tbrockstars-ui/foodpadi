import Link from 'next/link';
import { DEALER_FEATURED_MIN_COMPLETENESS } from '@foodpadi/shared';
import { loadOwnDealerOrOnboard } from '../dealerServer';
import { Panel, PageHeader, ScoreRing, StatusBadge } from '../ui';
import styles from '../../dealers.module.css';

export const dynamic = 'force-dynamic';

// "Search Visibility" (dealer brief §8/§11/§15) — explains FoodPadi search vs
// web SEO and shows the current Featured-eligibility state. Makes NO ranking
// guarantees (brief §14/§17/§70) — organic relevance always comes first.
export default async function DealerVisibilityPage() {
  const d = await loadOwnDealerOrOnboard();

  const wasApproved = ['approved', 'active', 'suspended', 'expired'].includes(d.listingStatus);
  const checks: { ok: boolean; label: string }[] = [
    { ok: wasApproved, label: 'Application approved by FoodPadi' },
    { ok: d.isLiveToCustomers, label: 'Live to customers (active subscription)' },
    { ok: d.profileCompleteness >= DEALER_FEATURED_MIN_COMPLETENESS, label: `Profile at least ${DEALER_FEATURED_MIN_COMPLETENESS}% complete` },
    { ok: d.verificationStatus === 'verified', label: 'FoodPadi Verified' },
  ];

  return (
    <>
      <PageHeader
        title="Search visibility"
        description="Improve where your business appears when customers search FoodPadi."
      />

      <Panel>
        <div className={styles.scoreRow}>
          <ScoreRing pct={d.isLiveToCustomers ? Math.max(d.profileCompleteness, 35) : 0} />
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>
              {d.isLiveToCustomers ? (
                <>
                  Your business is eligible for FoodPadi search.{' '}
                  <StatusBadge tone="lime">Good</StatusBadge>
                </>
              ) : (
                <>
                  Not yet visible to customers <StatusBadge tone="neutral">Inactive</StatusBadge>
                </>
              )}
            </p>
            <p className={styles.itemMeta} style={{ margin: 0 }}>
              {d.featuredEligible
                ? 'You currently meet the bar for Featured / Sponsored placement on relevant searches.'
                : 'Complete more of your profile while live and subscribed to unlock Featured eligibility.'}
            </p>
          </div>
        </div>

        <ul className={styles.checkList} style={{ marginTop: 'var(--space-lg)' }}>
          {checks.map((c) => (
            <li key={c.label}>
              <span className={`${styles.checkDot} ${c.ok ? styles.checkOn : styles.checkOff}`}>{c.ok ? '✓' : '·'}</span>
              {c.label}
            </li>
          ))}
        </ul>

        <div className={styles.rowActions}>
          <Link href="/dealers/dashboard/profile" className={styles.ctaPrimary}>
            Improve your profile
          </Link>
          {!d.isLiveToCustomers ? (
            <Link href="/dealers/dashboard/subscription" className={styles.ctaSecondary}>
              Explore visibility options
            </Link>
          ) : null}
        </div>
      </Panel>

      <div className={styles.panelGrid2}>
        <Panel title="Organic discovery" subtitle="Free, relevance-based">
          <p className={styles.itemMeta}>
            Your business name, products, categories, cuisines and localities are indexed so
            customers find you when a search genuinely matches — e.g. &ldquo;Nigerian groceries
            Leicester&rdquo;, &ldquo;egusi near Leicester&rdquo;. Relevance and proximity decide
            ranking.
          </p>
        </Panel>
        <Panel title="Featured visibility" subtitle="Paid, eligibility-gated">
          <p className={styles.itemMeta}>
            A subscription makes you <em>eligible</em> for a Featured / Sponsored slot on relevant
            searches — always clearly labelled to customers. It is not a guaranteed position, and
            payment never makes an unrelated result appear.
          </p>
        </Panel>
      </div>

      <Panel title="Web (Google) search">
        <p className={styles.itemMeta}>
          FoodPadi publishes a public page for your listing with appropriate metadata so search
          engines can understand it. FoodPadi cannot and does not guarantee a Google ranking —
          that depends entirely on external search engines.
        </p>
      </Panel>
    </>
  );
}
