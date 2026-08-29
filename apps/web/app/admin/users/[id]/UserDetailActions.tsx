'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../users.module.css';

interface Props {
  userId: string;
  suspended: boolean;
}

export function UserDetailActions({ userId, suspended }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSuspend = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-proxy/admin/users/${userId}/${suspended ? 'reactivate' : 'suspend'}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(`Something went wrong ${suspended ? 'reactivating' : 'suspending'} this user. Please try again.`);
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async () => {
    if (!window.confirm('Permanently delete this account and all their data? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-proxy/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      router.push('/admin/users');
      router.refresh();
    } catch {
      setError('Something went wrong deleting this user. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.actionRow}>
        <button className={styles.actionButton} type="button" onClick={toggleSuspend} disabled={busy}>
          {suspended ? 'Reactivate account' : 'Suspend account'}
        </button>
        <button className={`${styles.actionButton} ${styles.actionButtonDanger}`} type="button" onClick={deleteUser} disabled={busy}>
          Delete account
        </button>
      </div>
    </div>
  );
}
