'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { dealerApi } from '../../../lib/dealerClient';
import styles from '../dealers.module.css';

// Runs once when the post-checkout redirect lands on /dealers/dashboard?activated=1.
// Verifies the payment with the API (idempotent with the webhook) so the
// listing activates immediately — mirrors apps/web/app/premium/success.
export function DashboardActivation() {
  const params = useSearchParams();
  const router = useRouter();
  const ran = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current || params.get('activated') !== '1') return;
    ran.current = true;

    const provider = params.get('provider') === 'flutterwave' ? 'flutterwave' : 'stripe';
    const body =
      provider === 'flutterwave'
        ? {
            provider: 'flutterwave' as const,
            txRef: params.get('tx_ref') ?? undefined,
            transactionId: params.get('transaction_id') ?? undefined,
          }
        : { provider: 'stripe' as const, sessionId: params.get('session_id') ?? undefined };

    dealerApi
      .sync(body)
      .then((res) => {
        setMsg(
          res.justActivated || res.subscription.active
            ? 'Payment confirmed — your FoodPadi Food Dealer subscription is active.'
            : 'We received your payment and are finalising your subscription.',
        );
      })
      .catch(() => setMsg('We could not confirm the payment yet. It may take a moment to update.'))
      .finally(() => {
        // Drop the query params so a refresh doesn't re-run the sync.
        router.replace('/dealers/dashboard');
      });
  }, [params, router]);

  if (!msg) return null;
  return <p className={styles.success}>{msg}</p>;
}
