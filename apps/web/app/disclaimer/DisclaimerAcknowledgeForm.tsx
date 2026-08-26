'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISCLAIMER_TEXT } from '@foodpadi/shared';
import styles from '../onboarding.module.css';

/** Web counterpart to apps/mobile/src/screens/DisclaimerScreen.tsx. */
export function DisclaimerAcknowledgeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const acknowledge = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/proxy/users/me/disclaimer-acknowledge', { method: 'POST' });
      // The root page re-checks onboarding status and redirects on to /goal
      // — same single gate the mobile RootNavigator uses, not duplicated here.
      router.push('/');
      router.refresh();
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
