'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../dealer.module.css';

const REASONS: { value: string; label: string }[] = [
  { value: 'wrong_business', label: 'This is the wrong business / details' },
  { value: 'closed', label: 'This business has closed' },
  { value: 'incorrect_info', label: 'Some information is incorrect' },
  { value: 'inappropriate', label: 'Inappropriate content' },
];

export function ReportForm({ slug }: { slug: string }) {
  const [reason, setReason] = useState(REASONS[0].value);
  const [detail, setDetail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch(`/api/proxy/dealers/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, detail: detail.trim() || undefined }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <p className={styles.meta}>
        Thanks — we&apos;ve logged this for review. <Link href={`/dealer/${slug}`}>Back to the listing</Link>
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        <span className={styles.meta}>What&apos;s wrong?</span>
        <select className={styles.select} value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={styles.meta}>More detail (optional)</span>
        <textarea
          className={styles.textarea}
          value={detail}
          maxLength={1000}
          onChange={(e) => setDetail(e.target.value)}
        />
      </label>
      <button className={styles.submit} type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Submit report'}
      </button>
      {state === 'error' ? <p className={styles.meta}>Could not send that. Please try again.</p> : null}
    </form>
  );
}
