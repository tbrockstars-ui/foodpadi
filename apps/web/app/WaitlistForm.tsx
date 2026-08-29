'use client';

import { useState } from 'react';
import styles from './page.module.css';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
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
        body: JSON.stringify({ email: trimmed }),
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
    return <p className={styles.waitlistDone}>You&apos;re on the list — we&apos;ll email you when FoodPadi launches.</p>;
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
          {status === 'loading' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </form>
      {error ? <p className={styles.waitlistError}>{error}</p> : null}
    </div>
  );
}
