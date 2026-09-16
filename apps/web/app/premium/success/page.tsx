import Link from 'next/link';
import type { CheckoutSyncResponse } from '@foodpadi/shared';
import {
  redirectToLoginIfUnauthorized,
  requireSession,
  serverFetch,
} from '../../../lib/serverApi';
import { AppShell } from '../../../components/AppShell';
import shellStyles from '../../app-shell.module.css';
import styles from '../premium.module.css';

export const dynamic = 'force-dynamic';

/**
 * The checkout success redirect lands here.
 *  - Stripe: `?session_id=cs_...`
 *  - Flutterwave: `?provider=flutterwave&status=successful&tx_ref=...&transaction_id=...`
 *
 * We ask the API to verify the payment with the provider and unlock Premium
 * immediately — the redirect params alone never grant access, and the webhook
 * is still the ultimate authority. No refresh or re-login needed.
 */
export default async function PremiumSuccessPage({
  searchParams,
}: {
  searchParams: {
    session_id?: string;
    provider?: string;
    status?: string;
    tx_ref?: string;
    transaction_id?: string;
  };
}) {
  requireSession('/premium/success');

  const isFlutterwave = searchParams.provider === 'flutterwave';
  const body = isFlutterwave
    ? {
        provider: 'flutterwave' as const,
        txRef: searchParams.tx_ref,
        transactionId: searchParams.transaction_id,
      }
    : { sessionId: searchParams.session_id };
  const hasParams = isFlutterwave
    ? Boolean(searchParams.tx_ref && searchParams.transaction_id)
    : Boolean(searchParams.session_id);
  // Flutterwave sends `status=cancelled` when the customer backs out.
  const userCancelled = isFlutterwave && searchParams.status === 'cancelled';

  let result: CheckoutSyncResponse | null = null;
  let failed = false;
  if (hasParams && !userCancelled) {
    try {
      result = await serverFetch<CheckoutSyncResponse>('/billing/checkout/sync', {
        method: 'POST',
        body,
      });
    } catch (e) {
      redirectToLoginIfUnauthorized(e, '/premium/success');
      failed = true;
    }
  }

  const premium = result?.subscription.premium ?? false;

  return (
    <AppShell guest={false}>
      <main className={shellStyles.shellPage}>
        <div className={styles.card}>
          {premium ? (
            <>
              <div className={styles.successMark} aria-hidden="true">
                ✓
              </div>
              <h1 className={styles.title}>You&apos;re now on FoodPadi Premium.</h1>
              <p className={styles.lede}>
                Everything&apos;s unlocked — no need to sign in again.
              </p>
              <div className={styles.ctaWrap}>
                <Link href="/" className={styles.primaryButton}>
                  Go to FoodPadi
                </Link>
              </div>
              <p className={styles.finePrint}>
                Manage or cancel anytime from{' '}
                <Link href="/premium" className={styles.backLink}>
                  your subscription
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Your payment couldn&apos;t be completed.</h1>
              <p className={styles.lede}>
                {failed
                  ? 'We couldn’t confirm the payment. You have not been charged.'
                  : 'No charge was made. You can try again whenever you’re ready.'}
              </p>
              <div className={styles.ctaWrap}>
                <Link href="/premium" className={styles.primaryButton}>
                  Try again
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}
