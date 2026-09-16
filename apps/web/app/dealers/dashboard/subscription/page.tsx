import Link from 'next/link';
import { DEALER_PAYABLE_STATUSES, type DealerSubscriptionView } from '@foodpadi/shared';
import { ApiError, serverFetch } from '../../../../lib/serverApi';
import { loadOwnDealerOrOnboard } from '../dealerServer';
import { SubscriptionActions } from './SubscriptionActions';
import { formatMoney } from '../../../../lib/money';
import { EmptyState, Panel, PageHeader, StatusBadge } from '../ui';
import styles from '../../dealers.module.css';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
}

const BENEFITS = [
  'A searchable FoodPadi dealer profile (web + mobile)',
  'Product and category indexing in FoodPadi search',
  'Featured / Sponsored eligibility for relevant searches',
  'A dealer dashboard with discovery analytics',
];

// A dealer must be admin-approved before they can ever be offered payment
// (2026-09-11) — this is the UI half of that rule; DealerPortalService.
// createCheckout enforces the same thing server-side regardless of what this
// page renders (brief §22). Every non-payable listingStatus gets its own
// honest copy — no silent fallback that could mislabel e.g. a draft as
// "suspended".
function isPayable(status: string): boolean {
  return (DEALER_PAYABLE_STATUSES as string[]).includes(status);
}

const UNAVAILABLE_COPY: Record<string, { title: string; text: string }> = {
  draft: {
    title: 'Finish your application first',
    text: 'Complete and submit your Food Dealer application before a subscription is available.',
  },
  pending_review: {
    title: 'Not available yet',
    text: "Your Food Dealer application must be approved by FoodPadi before you can subscribe. You'll be able to choose a plan here as soon as a decision has been made — no payment is needed while you wait.",
  },
  changes_requested: {
    title: 'Not available yet',
    text: 'FoodPadi has asked for a few changes to your application. Update and resubmit it from the Overview page — you can subscribe once it is approved.',
  },
  rejected: {
    title: 'Subscription unavailable',
    text: 'Your Food Dealer application was not approved, so a subscription is not available.',
  },
  suspended: {
    title: 'Subscription unavailable',
    text: 'Your listing is currently suspended, so a subscription is not available.',
  },
};

export default async function DealerSubscriptionPage() {
  const dealer = await loadOwnDealerOrOnboard();
  let sub: DealerSubscriptionView | null = null;
  try {
    sub = await serverFetch<DealerSubscriptionView>('/dealers/me/subscription');
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  const payable = isPayable(dealer.listingStatus);
  const unavailable = UNAVAILABLE_COPY[dealer.listingStatus] ?? {
    title: 'Subscription unavailable',
    text: 'A subscription is not available for your listing right now.',
  };

  return (
    <>
      <PageHeader title="Subscription" description="Your FoodPadi Food Dealer membership." />

      {!payable ? (
        <EmptyState
          icon="⏳"
          title={unavailable.title}
          text={unavailable.text}
          action={
            <Link href="/dealers/dashboard" className={styles.ctaSecondary}>
              Back to overview
            </Link>
          }
        />
      ) : null}

      {payable ? (
        <>
          <Panel>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Current plan</p>
                <p className={styles.panelSub}>Dealer monthly · billed to the account you subscribed with</p>
              </div>
              <StatusBadge tone={sub?.active ? 'lime' : !sub || sub.status === 'none' ? 'neutral' : 'red'}>
                {sub?.active ? 'Active' : !sub || sub.status === 'none' ? 'Not subscribed' : sub.status}
              </StatusBadge>
            </div>

            <div className={styles.panelGrid2}>
              <div>
                <p className={styles.fieldLabel} style={{ marginBottom: 2 }}>Price</p>
                <p style={{ margin: 0 }}>
                  {sub ? `${formatMoney(sub.price)} / ${sub.billingInterval}` : '—'}
                  {sub?.presentment ? (
                    <span className={styles.fieldHint}> · charged {formatMoney(sub.presentment)}</span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className={styles.fieldLabel} style={{ marginBottom: 2 }}>Renews / ends</p>
                <p style={{ margin: 0 }}>
                  {fmtDate(sub?.currentPeriodEnd ?? null)}
                  {sub?.cancelAtPeriodEnd ? <span className={styles.fieldHint}> · cancellation scheduled</span> : null}
                </p>
              </div>
              <div>
                <p className={styles.fieldLabel} style={{ marginBottom: 2 }}>Billing provider</p>
                <p style={{ margin: 0, textTransform: 'capitalize' }}>{sub?.provider ?? '—'}</p>
              </div>
            </div>

            {sub ? <SubscriptionActions initial={sub} /> : null}
          </Panel>

          <Panel title="What's included">
            <ul className={styles.checkList}>
              {BENEFITS.map((b) => (
                <li key={b}>
                  <span className={`${styles.checkDot} ${styles.checkOn}`}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <p className={styles.itemMeta}>
              If your subscription lapses, your listing stops receiving Featured / Sponsored
              visibility and is removed from FoodPadi customer search after any grace period. Your
              profile data is kept — renewing restores the listing immediately.
            </p>
          </Panel>
        </>
      ) : null}
    </>
  );
}
