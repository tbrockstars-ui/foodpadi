import Link from 'next/link';
import type { SubscriptionView } from '@foodpadi/shared';
import { redirectToLoginIfUnauthorized, requireSession, serverFetch } from '../../../lib/serverApi';
import { AppShell } from '../../../components/AppShell';
import { formatPricePerMonth } from '../../../lib/money';
import shellStyles from '../../app-shell.module.css';
import styles from '../premium.module.css';
import { CancelSubscriptionButton } from '../CancelSubscriptionButton';

export const dynamic = 'force-dynamic';

/**
 * Stand-in for Stripe's hosted Billing Portal, shown only when the API runs
 * with `STRIPE_DEMO_MODE=true` — a demo subscription has no real Stripe
 * customer to send to a real portal. Reuses the same `CancelSubscriptionButton`
 * Flutterwave's in-app cancellation already uses; the API's `/billing/cancel`
 * recognises a demo Stripe subscription and cancels it locally. Mirrors
 * `../demo-checkout/page.tsx`'s "local stand-in for a provider surface" role.
 */
export default async function StripeDemoPortalPage() {
  requireSession('/premium/stripe-demo-portal');

  let subscription: SubscriptionView | null = null;
  try {
    subscription = await serverFetch<SubscriptionView>('/billing/subscription');
  } catch (e) {
    redirectToLoginIfUnauthorized(e, '/premium/stripe-demo-portal');
  }

  const nextPayment = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Stripe · Demo portal</p>
          <h1 className={styles.title}>Manage your subscription</h1>

          <p className={styles.notice}>
            This is a demo billing portal. No real Stripe account is involved.
          </p>

          {subscription ? (
            <dl className={styles.detailGrid}>
              <div className={styles.detailRow}>
                <dt>Status</dt>
                <dd>
                  {subscription.cancelAtPeriodEnd && nextPayment
                    ? `Cancelled — active until ${nextPayment}`
                    : subscription.status ?? 'active'}
                </dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Price</dt>
                <dd>{formatPricePerMonth(subscription.base, 'en-US')}</dd>
              </div>
              {nextPayment ? (
                <div className={styles.detailRow}>
                  <dt>{subscription.cancelAtPeriodEnd ? 'Access until' : 'Next payment'}</dt>
                  <dd>{nextPayment}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {subscription && !subscription.cancelAtPeriodEnd ? (
            <CancelSubscriptionButton nextPayment={nextPayment} />
          ) : null}

          <p className={styles.finePrint}>
            In production this screen is Stripe&apos;s own hosted Billing Portal (payment method,
            invoices, cancellation). Set <code>STRIPE_DEMO_MODE=false</code> and configure a
            Stripe secret key to use it.
          </p>

          <p className={styles.finePrint}>
            <Link href="/premium" className={styles.backLink}>
              Back to FoodPadi Premium
            </Link>
          </p>
        </div>
      </main>
    </AppShell>
  );
}
