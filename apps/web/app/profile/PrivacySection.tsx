'use client';

import { useState } from 'react';
import styles from './profile.module.css';

export function PrivacySection() {
  const [exportedData, setExportedData] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportMyData = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/proxy/users/me/export');
      const data = await res.json();
      setExportedData(JSON.stringify(data, null, 2));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/users/me', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      // Same as mobile's deleteAccount() -> logout(): clear the session and
      // land back on the (now-unauthenticated) home page.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/auth/logout';
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div>
      <button type="button" className={styles.secondaryButton} onClick={exportMyData} disabled={exporting}>
        {exporting ? 'Exporting…' : 'Export my data'}
      </button>
      {exportedData ? (
        <div className={styles.exportBox}>
          <pre className={styles.exportText}>{exportedData}</pre>
        </div>
      ) : null}

      <div style={{ height: 'var(--space-lg)' }} />

      {!confirmingDelete ? (
        <button type="button" className={styles.dangerButton} onClick={() => setConfirmingDelete(true)}>
          Delete my account
        </button>
      ) : (
        <div className={styles.confirmBox}>
          <p className={styles.confirmText}>
            This permanently deletes your account and everything FoodPadi has stored about you. This
            can&apos;t be undone.
          </p>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button type="button" className={styles.dangerButton} onClick={deleteAccount} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      )}
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}
