'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './premium.module.css';

/**
 * In-app cancellation for Flutterwave subscriptions (Flutterwave has no hosted
 * portal). Premium stays active until the current paid period ends.
 */
export function CancelSubscriptionButton({ nextPayment }: { nextPayment: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirm' | 'loading' | 'error'>('idle');

  const cancel = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/proxy/billing/cancel', { method: 'POST' });
      if (!res.ok) {
        setState('error');
        return;
      }
      router.refresh();
    } catch {
      setState('error');
    }
  };

  if (state === 'confirm' || state === 'loading') {
    return (
      <div className={styles.ctaWrap}>
        <p className={styles.finePrint}>
          Cancel your subscription? You&apos;ll keep Premium
          {nextPayment ? ` until ${nextPayment}` : ' until the end of the paid period'}.
        </p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={cancel}
          disabled={state === 'loading'}
        >
          {state === 'loading' ? 'Cancelling…' : 'Yes, cancel subscription'}
        </button>
        <button type="button" className={styles.linkButton} onClick={() => setState('idle')}>
          Keep my subscription
        </button>
      </div>
    );
  }

  return (
    <div className={styles.ctaWrap}>
      <button type="button" className={styles.secondaryButton} onClick={() => setState('confirm')}>
        Cancel subscription
      </button>
      {state === 'error' ? (
        <p className={styles.errorText}>Couldn&apos;t cancel just now. Please try again.</p>
      ) : null}
    </div>
  );
}
