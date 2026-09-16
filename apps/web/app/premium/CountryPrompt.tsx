'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountrySelect, guessCountryFromBrowser } from '../../components/CountrySelect';
import styles from './premium.module.css';

/**
 * Shown on the paywall when the account has no country of residence yet
 * (registered before we asked, or via a path that didn't collect it). Saving
 * it refreshes the page so pricing switches to the right currency / provider.
 */
export function CountryPrompt() {
  const router = useRouter();
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCountry((c) => c || guessCountryFromBrowser());
  }, []);

  const save = async () => {
    if (!country) {
      setError('Please choose your country.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: country }),
      });
      if (!res.ok) {
        setError('Could not save that. Please try again.');
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Could not save that. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className={`${styles.card} ${styles.countryPrompt}`}>
      <p className={styles.eyebrow}>Where are you?</p>
      <p className={styles.lede}>
        Tell us your country of residence so we can show your local currency and price.
      </p>
      <div className={styles.ctaWrap}>
        <CountrySelect
          className={styles.countrySelect}
          value={country}
          onChange={setCountry}
          aria-label="Country of residence"
        />
        <button
          type="button"
          className={styles.primaryButton}
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}
