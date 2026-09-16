'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentProvider } from '@foodpadi/shared';
import styles from './premium.module.css';

/**
 * Opens the provider's hosted checkout (Stripe by default, Flutterwave for
 * Nigeria). The server owns the price, currency and customer — this only asks
 * for a URL and redirects to it. Card details are never collected in FoodPadi.
 */
export function ContinueButton({ provider = 'stripe' }: { provider?: PaymentProvider }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const start = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/proxy/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.status === 409) {
        router.refresh();
        return;
      }
      if (!res.ok) {
        setState('error');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch {
      setState('error');
    }
  };

  return (
    <div className={styles.ctaWrap}>
      <button
        type="button"
        className={styles.primaryButton}
        onClick={start}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? 'Opening secure checkout…' : 'Continue'}
      </button>
      {state === 'error' ? (
        <p className={styles.errorText}>
          We couldn&apos;t start checkout just now.{' '}
          <button type="button" className={styles.linkButton} onClick={start}>
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
