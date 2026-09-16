import Link from 'next/link';
import { requireSession } from '../../../lib/serverApi';
import { AppShell } from '../../../components/AppShell';
import { formatMoney } from '../../../lib/money';
import shellStyles from '../../app-shell.module.css';
import styles from '../premium.module.css';

export const dynamic = 'force-dynamic';

/**
 * Stand-in for Stripe's hosted Checkout, shown only when the API runs with
 * `STRIPE_DEMO_MODE=true`. No real card is charged — "Pay" redirects to the
 * normal success page with the same `session_id` shape a real Stripe redirect
 * uses, which the API's demo `retrieveCheckoutSession` recognises and treats
 * as a successful subscription. Lets the whole Premium journey be demoed end
 * to end without a Stripe account. Mirrors `../demo-checkout/page.tsx`
 * (Flutterwave's equivalent).
 */
export default function StripeDemoCheckoutPage({
  searchParams,
}: {
  searchParams: { session_id?: string; amount?: string; currency?: string };
}) {
  requireSession('/premium/stripe-demo-checkout');

  const sessionId = searchParams.session_id ?? '';
  const amountCents = Number(searchParams.amount ?? '499');
  const currency = searchParams.currency ?? 'usd';
  const price = formatMoney({ amountCents, currency });

  const successHref = `/premium/success?session_id=${encodeURIComponent(sessionId)}`;
  const cancelHref = '/premium?checkout=cancelled';

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Stripe · Demo</p>
          <h1 className={styles.title}>Pay {price}/month</h1>
          <p className={styles.lede}>FoodPadi Premium — billed monthly.</p>

          <p className={styles.notice}>
            This is a demo checkout. No card is charged and no real payment is taken.
          </p>

          <div className={styles.ctaWrap}>
            <Link href={successHref} className={styles.primaryButton}>
              Pay {price} (demo)
            </Link>
            <Link href={cancelHref} className={styles.linkButton}>
              Cancel and go back
            </Link>
          </div>

          <p className={styles.finePrint}>
            In production this screen is Stripe&apos;s own hosted Checkout (card, wallets, local
            payment methods). Set <code>STRIPE_DEMO_MODE=false</code> and configure a Stripe
            secret key + price id to use it.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
