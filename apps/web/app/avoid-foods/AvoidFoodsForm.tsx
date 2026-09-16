'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AvoidedIngredientItem } from '@foodpadi/shared';
import styles from '../onboarding.module.css';

// Common things people choose to leave out. Not an allergen checklist —
// FoodPadi shows ingredients and lets you decide (the disclaimer principle),
// it doesn't diagnose. Free-text covers anything not here.
const COMMON_AVOIDS = [
  'Pork', 'Beef', 'Shellfish', 'Fish', 'Peanuts', 'Tree nuts', 'Eggs', 'Dairy',
  'Gluten', 'Soy', 'Mushrooms', 'Onion', 'Garlic', 'Coriander (cilantro)',
  'Alcohol', 'Very spicy food',
] as const;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Onboarding step (after cuisines) — the customer's "Foods I choose to avoid"
 * list. FoodPadi keeps these out of every recommendation. Each add/remove is
 * saved immediately (same as the Profile editor), so going back and forth
 * doesn't lose anything; Continue / Skip just finish onboarding.
 */
export function AvoidFoodsForm() {
  const router = useRouter();
  const [items, setItems] = useState<AvoidedIngredientItem[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const has = (name: string) => items.some((i) => sameName(i.ingredientName, name));

  const add = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || has(trimmed) || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/proxy/users/me/avoided-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientName: trimmed }),
      });
      if (res.ok) {
        const created = (await res.json()) as AvoidedIngredientItem;
        setItems((cur) => [...cur, created]);
        setText('');
      }
    } finally {
      setBusy(false);
    }
  };

  const removeByName = async (name: string) => {
    const item = items.find((i) => sameName(i.ingredientName, name));
    if (!item) return;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    await fetch(`/api/proxy/users/me/avoided-ingredients/${item.id}`, { method: 'DELETE' }).catch(
      () => undefined,
    );
  };

  const toggleCommon = (name: string) => (has(name) ? removeByName(name) : add(name));

  const finish = async () => {
    setFinishing(true);
    try {
      await fetch('/api/proxy/users/me/complete-onboarding', { method: 'POST' });
      // One more optional, skippable step (Daily Companion Reminders) before
      // landing home — onboarding itself is already marked complete above,
      // exactly as before this step existed.
      router.push('/daily-reminders?onboarding=1');
      router.refresh();
    } finally {
      setFinishing(false);
    }
  };

  const extras = items.filter((i) => !COMMON_AVOIDS.some((c) => sameName(c, i.ingredientName)));

  return (
    <div>
      <h1 className={styles.heading}>Any foods you&apos;d rather avoid?</h1>
      <p className={styles.subtitle}>
        FoodPadi will keep these out of every recommendation. This isn&apos;t a medical or allergy
        tool — it&apos;s simply your choice, and you can change it anytime.
      </p>

      <div className={styles.chipWrap}>
        {COMMON_AVOIDS.map((name) => (
          <button
            key={name}
            type="button"
            className={`${styles.chip} ${has(name) ? styles.chipSelected : ''}`}
            onClick={() => toggleCommon(name)}
            disabled={busy || finishing}
          >
            {name}
          </button>
        ))}
      </div>

      {extras.length > 0 ? (
        <div className={styles.tagList}>
          {extras.map((item) => (
            <span key={item.id} className={styles.removableTag}>
              {item.ingredientName}
              <button
                type="button"
                className={styles.removeIcon}
                onClick={() => removeByName(item.ingredientName)}
                aria-label={`Remove ${item.ingredientName}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Add something else"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add(text);
            }
          }}
          disabled={busy || finishing}
        />
        <button
          type="button"
          className={styles.addButton}
          onClick={() => add(text)}
          disabled={busy || finishing || !text.trim()}
        >
          Add
        </button>
      </div>

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={finish}
          disabled={finishing}
        >
          {finishing ? 'Finishing…' : items.length > 0 ? `Continue (${items.length})` : 'Continue'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={finish}
          disabled={finishing}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
