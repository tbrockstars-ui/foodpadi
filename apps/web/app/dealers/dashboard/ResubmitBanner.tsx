'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { dealerApi } from '../../../lib/dealerClient';
import styles from '../dealers.module.css';

/**
 * "Correct and resend for review" — shared by ApplicationStatusPanel (the
 * Overview page) and ProfileEditor (so a dealer can resend right where they
 * just made the fix, no extra navigation). Covers both `changes_requested`
 * and `rejected`: neither is a dead end — DealerPortalService.submit puts
 * either one back in `pending_review`, the same review queue a fresh
 * application uses (user instruction, 2026-09-15 — rejection is not
 * permanently terminal).
 */
export function ResubmitBanner({
  note,
  rejected,
  onResubmitted,
  secondaryAction,
}: {
  note: string | null;
  rejected: boolean;
  /** Called after a successful resubmit, in addition to refreshing server data. */
  onResubmitted?: () => void;
  /** An extra action (e.g. "Update application") shown alongside Resend, in the same row. */
  secondaryAction?: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await dealerApi.submit();
      router.refresh();
      onResubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend your application.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {note ? (
        <div className={styles.card} style={{ margin: '0 0 var(--space-md)', background: 'var(--surface-sunken)' }}>
          <p className={styles.fieldLabel} style={{ marginBottom: 4 }}>
            {rejected ? 'Reason' : 'Admin message'}
          </p>
          <p style={{ margin: 0 }}>{note}</p>
        </div>
      ) : null}
      <div className={styles.rowActions} style={{ marginTop: 0 }}>
        {secondaryAction}
        <button className={styles.ctaPrimary} onClick={resubmit} disabled={busy}>
          {busy ? 'Resending…' : "I've made changes — Resend for review"}
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </>
  );
}
