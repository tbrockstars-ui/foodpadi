'use client';

import { useState } from 'react';
import type { FoodPreferenceItem } from '@foodpadi/shared';
import styles from './profile.module.css';

export function CuisinesSection({ initialPreferences }: { initialPreferences: FoodPreferenceItem[] }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [newCuisine, setNewCuisine] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const trimmed = newCuisine.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch('/api/proxy/users/me/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuisine: trimmed }),
      });
      const created = await res.json();
      setPreferences((current) => [...current, created]);
      setNewCuisine('');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setPreferences((current) => current.filter((p) => p.id !== id));
    await fetch(`/api/proxy/users/me/preferences/${id}`, { method: 'DELETE' });
  };

  return (
    <div>
      {preferences.length === 0 ? (
        <p className={styles.emptyText}>Nothing added yet.</p>
      ) : (
        <div className={styles.tagList}>
          {preferences.map((pref) => (
            <span key={pref.id} className={styles.removableTag}>
              {pref.cuisine ?? pref.likedMeal ?? 'Preference'}
              <button
                type="button"
                className={styles.removeIcon}
                onClick={() => remove(pref.id)}
                aria-label="Remove"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Add a cuisine you love"
          value={newCuisine}
          onChange={(e) => setNewCuisine(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          disabled={busy}
        />
        <button type="button" className={styles.addButton} onClick={add} disabled={busy || !newCuisine.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
