import Link from 'next/link';
import { requireSession } from '../../../lib/serverApi';
import { AppShell } from '../../../components/AppShell';
import { formatMoney } from '../../../lib/money';
import shellStyles from '../../app-shell.module.css';
import styles from '../premium.module.css';

export const dynamic = 'force-dynamic';

/**
 * Stand-in for Flutterwave's hosted checkout, shown only when the API runs
 * with `FLW_DEMO_MODE=true`. No real payment is taken — "Pay" just redirects
 * to the normal success page with a demo transaction id, which the API's demo
 * `verifyTransaction` treats as a successful NGN charge. Lets the whole
 * Nigeria journey be demoed end to end without a Flutterwave account.
 */
export default function DemoCheckoutPage({
  searchParams,
}: {
  searchParams: { tx_ref?: string; amount?: string };
}) {
  requireSession('/premium/demo-checkout');

  const txRef = searchParams.tx_ref ?? '';
  const amountNaira = Number(searchParams.amount ?? '0');
  const price = formatMoney({ amountCents: amountNaira * 100, currency: 'ngn' });

  const successHref = `/premium/success?provider=flutterwave&status=successful&tx_ref=${encodeURIComponent(
    txRef,
  )}&transaction_id=${encodeURIComponent(`DEMO-${txRef}`)}`;
  const cancelHref = `/premium/success?provider=flutterwave&status=cancelled&tx_ref=${encodeURIComponent(
    txRef,
  )}`;

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>Flutterwave · Demo</p>
          <h1 className={styles.title}>Pay {price}/month</h1>
          <p className={styles.lede}>FoodPadi Premium — billed monthly in Naira.</p>

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
            In production this screen is Flutterwave&apos;s own hosted page (card, bank transfer,
            USSD). Set <code>FLW_DEMO_MODE=false</code> and configure Flutterwave keys to use it.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
