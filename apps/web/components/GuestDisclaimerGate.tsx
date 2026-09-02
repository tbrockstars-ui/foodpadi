'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DISCLAIMER_TEXT } from '@foodpadi/shared';
import styles from '../app/onboarding.module.css';

interface Props {
  /** From getGuestState() on the server page. Signed-in users pass `true`. */
  acknowledged: boolean;
  children: ReactNode;
}

/**
 * Lazy food/safety disclaimer gate for guest pages — the web twin of the
 * mobile screens' `needsGuestDisclaimer` check. Shows the disclaimer the
 * first time a guest reaches a feature that surfaces recipes/ingredients,
 * then renders the feature. The API also 403s an unacknowledged guest, so
 * this is the friendly front of that boundary, not the only enforcement.
 */
export function GuestDisclaimerGate({ acknowledged, children }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(acknowledged);
  const [submitting, setSubmitting] = useState(false);

  if (done) return <>{children}</>;

  const acknowledge = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/guest/acknowledge-disclaimer', { method: 'POST' });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className={styles.heading}>Before you start</h1>
      <div className={styles.disclaimerBox}>
        <p className={styles.disclaimerText}>{DISCLAIMER_TEXT}</p>
      </div>
      <button type="button" className={styles.primaryButton} onClick={acknowledge} disabled={submitting}>
        {submitting ? 'Saving…' : 'I understand'}
      </button>
    </div>
  );
}
