'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../onboarding.module.css';

const CUISINES = [
  'Italian', 'Chinese', 'Indian', 'Nigerian & West African', 'Mexican', 'Japanese',
  'Thai', 'Mediterranean', 'British & comfort food', 'French', 'Caribbean', 'Middle Eastern',
] as const;

/** Web counterpart to apps/mobile/src/screens/PreferencesScreen.tsx — the final onboarding step. */
export function PreferencesForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (cuisine: string) => {
    setSelected((current) => (current.includes(cuisine) ? current.filter((c) => c !== cuisine) : [...current, cuisine]));
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      await Promise.all(
        selected.map((cuisine) =>
          fetch('/api/proxy/users/me/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cuisine }),
          }),
        ),
      );
      await fetch('/api/proxy/users/me/complete-onboarding', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const skip = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/proxy/users/me/complete-onboarding', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className={styles.heading}>Any cuisines you love?</h1>
      <p className={styles.subtitle}>Pick as many as you like — FoodPadi will learn more about your taste as you go.</p>
      <div className={styles.chipWrap}>
        {CUISINES.map((cuisine) => (
          <button
            key={cuisine}
            type="button"
            className={`${styles.chip} ${selected.includes(cuisine) ? styles.chipSelected : ''}`}
            onClick={() => toggle(cuisine)}
            disabled={submitting}
          >
            {cuisine}
          </button>
        ))}
      </div>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.primaryButton} onClick={finish} disabled={submitting}>
          {submitting ? 'Saving…' : selected.length > 0 ? `Continue (${selected.length})` : 'Continue'}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={skip} disabled={submitting}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
