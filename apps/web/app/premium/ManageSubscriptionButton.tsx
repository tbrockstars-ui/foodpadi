'use client';

import { useState } from 'react';
import styles from './premium.module.css';

/**
 * Opens the Stripe billing customer portal — cancellation, payment-method
 * changes, billing details, invoices and renewal all live there, so FoodPadi
 * doesn't reimplement any of it.
 */
export function ManageSubscriptionButton({ variant = 'primary' }: { variant?: 'primary' | 'link' }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const open = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/proxy/billing/portal', { method: 'POST' });
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
        className={variant === 'link' ? styles.linkButton : styles.secondaryButton}
        onClick={open}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? 'Opening…' : 'Manage subscription'}
      </button>
      {state === 'error' ? (
        <p className={styles.errorText}>Couldn&apos;t open the billing portal. Please try again.</p>
      ) : null}
    </div>
  );
}
