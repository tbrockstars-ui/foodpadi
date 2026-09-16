'use client';

import { useState } from 'react';
import { MARKETING_CONSENT_COPY } from '@foodpadi/shared';
import styles from './page.module.css';

interface WaitlistFormProps {
  /** 'ios_waitlist' for the dedicated /ios-waitlist page; defaults to the generic "notify me" signup. */
  purpose?: 'general' | 'ios_waitlist';
  /** First-touch attribution, e.g. from ?source=tiktok&campaign=askfoodpadi — passed through as-is. */
  source?: string;
  campaign?: string;
  submitLabel?: string;
  doneMessage?: string;
}

export function WaitlistForm({
  purpose,
  source,
  campaign,
  submitLabel = 'Join the waitlist',
  doneMessage = "You're on the list — we'll email you when FoodPadi launches.",
}: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  // Unticked by default — joining the waitlist itself is never marketing
  // consent, so this is a separate, explicit opt-in (launch brief §14).
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/proxy/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, marketingConsent, purpose, source, campaign }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(message ?? 'Something went wrong — try again.');
      }
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.');
      setStatus('error');
    }
  };

  if (status === 'done') {
    return <p className={styles.waitlistDone}>{doneMessage}</p>;
  }

  return (
    <div>
      <form
        className={styles.waitlistRow}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          id="waitlist-email"
          className={styles.waitlistInput}
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
        <button type="submit" className={styles.waitlistButton} disabled={!email.trim() || status === 'loading'}>
          {status === 'loading' ? 'Joining…' : submitLabel}
        </button>
      </form>
      <label className={styles.waitlistConsent}>
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
        />
        {MARKETING_CONSENT_COPY}
      </label>
      {error ? <p className={styles.waitlistError}>{error}</p> : null}
    </div>
  );
}
