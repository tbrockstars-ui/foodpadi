'use client';

import { useState } from 'react';
import type { AvoidedIngredientItem } from '@foodpadi/shared';
import styles from './profile.module.css';

export function AvoidedIngredientsSection({ initialAvoided }: { initialAvoided: AvoidedIngredientItem[] }) {
  const [avoided, setAvoided] = useState(initialAvoided);
  const [newAvoided, setNewAvoided] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const trimmed = newAvoided.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch('/api/proxy/users/me/avoided-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientName: trimmed }),
      });
      const created = await res.json();
      setAvoided((current) => [...current, created]);
      setNewAvoided('');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setAvoided((current) => current.filter((a) => a.id !== id));
    await fetch(`/api/proxy/users/me/avoided-ingredients/${id}`, { method: 'DELETE' });
  };

  return (
    <div>
      {avoided.length === 0 ? (
        <p className={styles.emptyText}>Nothing added yet.</p>
      ) : (
        <div className={styles.tagList}>
          {avoided.map((item) => (
            <span key={item.id} className={styles.removableTag}>
              {item.ingredientName}
              <button
                type="button"
                className={styles.removeIcon}
                onClick={() => remove(item.id)}
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
          placeholder="Add a food to avoid"
          value={newAvoided}
          onChange={(e) => setNewAvoided(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          disabled={busy}
        />
        <button type="button" className={styles.addButton} onClick={add} disabled={busy || !newAvoided.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
