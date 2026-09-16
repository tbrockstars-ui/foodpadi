import Link from 'next/link';
import { requireSession } from '../../../../lib/serverApi';
import { formatMoney } from '../../../../lib/money';
import styles from '../../dealers.module.css';

export const dynamic = 'force-dynamic';

/**
 * Stand-in for the provider's hosted checkout, shown only when the API runs in
 * demo mode (STRIPE_DEMO_MODE / FLW_DEMO_MODE). No real money moves — "Pay"
 * redirects to the dashboard with the same redirect params a real provider
 * would send, which the API's demo sync recognises as a successful charge.
 * Mirrors apps/web/app/premium/stripe-demo-checkout for the dealer product.
 */
export default function DealerDemoCheckoutPage({
  searchParams,
}: {
  searchParams: { session_id?: string; tx_ref?: string; amount?: string; currency?: string; provider?: string };
}) {
  requireSession('/dealers/onboarding/demo-checkout');

  const isFlutterwave = searchParams.provider === 'flutterwave';
  const amount = Number(searchParams.amount ?? (isFlutterwave ? '7500' : '499'));
  const price = isFlutterwave
    ? `₦${amount.toLocaleString()}`
    : formatMoney({ amountCents: amount, currency: searchParams.currency ?? 'usd' });

  const dash = new URLSearchParams({ activated: '1' });
  if (isFlutterwave) {
    const txRef = searchParams.tx_ref ?? '';
    dash.set('provider', 'flutterwave');
    dash.set('tx_ref', txRef);
    dash.set('transaction_id', `DEMO-${txRef}`);
  } else {
    dash.set('session_id', searchParams.session_id ?? '');
  }
  const successHref = `/dealers/dashboard?${dash.toString()}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.content} style={{ maxWidth: 460, margin: '4rem auto' }}>
        <div className={styles.card}>
          <p className={styles.heroEyebrow}>{isFlutterwave ? 'Flutterwave' : 'Stripe'} · Demo</p>
          <h1 className={styles.pageTitle}>Pay {price} / month</h1>
          <p className={styles.pageLede}>FoodPadi Food Dealer Network — billed monthly.</p>
          <p className={styles.itemMeta}>
            This is a demo checkout. No card is charged and no real payment is taken.
          </p>
          <div className={styles.rowActions}>
            <Link href={successHref} className={styles.ctaPrimary}>
              Pay {price} (demo)
            </Link>
            <Link href="/dealers/onboarding?checkout=cancelled" className={styles.ctaSecondary}>
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
