'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { countryName } from '@foodpadi/shared';
import { CountrySelect } from '../../components/CountrySelect';
import styles from './profile.module.css';

/**
 * Country of residence — set at registration, editable here. Drives the
 * FoodPadi Premium currency, local price and payment provider.
 */
export function CountrySection({ initialCode }: { initialCode: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? '');
  const [editing, setEditing] = useState(!initialCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!code) {
      setError('Please choose a country.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: code }),
      });
      if (!res.ok) {
        setError('Could not save. Please try again.');
        setSaving(false);
        return;
      }
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className={styles.addRow}>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>
          {countryName(code) ?? 'Not set'}
        </span>
        <button type="button" className={styles.addButton} onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.addRow}>
        <CountrySelect
          className={styles.addInput}
          value={code}
          onChange={setCode}
          aria-label="Country of residence"
        />
        <button type="button" className={styles.addButton} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error ? <p className={styles.emptyText} style={{ color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  );
}
