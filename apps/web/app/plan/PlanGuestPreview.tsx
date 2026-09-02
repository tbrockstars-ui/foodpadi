'use client';

import { useState } from 'react';
import type { PlanPreviewResponse } from '@foodpadi/shared';
import styles from './plan.module.css';
import { MemberBenefitCard } from '../../components/MemberBenefitCard';

const SCOPES: { label: string; days: number }[] = [
  { label: 'Just tomorrow', days: 1 },
  { label: '3 days', days: 3 },
  { label: 'This week', days: 7 },
];

/**
 * Guest / signed-out Plan Ahead — an AI-free preview from the curated recipe
 * pool (GET /plan-ahead/preview). Nothing is saved; a real plan with
 * reminders and per-day edits needs a free account. Web counterpart of
 * apps/mobile/src/screens/PlanAheadGuestPreview.tsx.
 */
export function PlanGuestPreview() {
  const [days, setDays] = useState(3);
  const [preview, setPreview] = useState<PlanPreviewResponse['days'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/plan-ahead/preview?days=${d}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(message ?? 'Could not load a preview right now.');
      }
      setPreview(((await res.json()) as PlanPreviewResponse).days);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load a preview right now.');
    } finally {
      setLoading(false);
    }
  };

  const pickScope = (d: number) => {
    setDays(d);
    if (preview) void load(d);
  };

  return (
    <div>
      <h1 className={styles.title}>Plan your next few meals</h1>
      <p className={styles.subtitle}>A preview of how Plan Ahead works — no account needed to look around.</p>

      <div className={styles.chipWrap}>
        {SCOPES.map((s) => (
          <button
            key={s.days}
            type="button"
            className={`${styles.chip} ${days === s.days ? styles.chipSelected : ''}`}
            onClick={() => pickScope(s.days)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!preview ? (
        <div style={{ marginTop: 24 }}>
          <button type="button" className={styles.primaryButton} onClick={() => load(days)} disabled={loading}>
            {loading ? 'Loading…' : 'Show a sample plan'}
          </button>
        </div>
      ) : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}

      {preview ? (
        <>
          <div style={{ marginTop: 24 }}>
            {preview.map(({ dayIndex, recipe }) => (
              <div key={dayIndex} className={styles.mealCard}>
                <div className={styles.mealContent}>
                  <p className={styles.mealDate}>Day {dayIndex + 1}</p>
                  <p className={styles.mealTitle}>{recipe.title}</p>
                  <div className={styles.tagRow}>
                    <span className={styles.tag}>{recipe.cookTimeMinutes} min</span>
                    <span className={styles.tag}>{recipe.servings} servings</span>
                    {recipe.cuisine ? <span className={styles.tag}>{recipe.cuisine}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <MemberBenefitCard
            icon="🗓"
            title="Want FoodPadi to remember your plan?"
            body="This preview isn't saved. With a free account your plan sticks around and works for you."
            bullets={[
              'Save your meal plans',
              'Get a reminder before it’s time to cook',
              'Pick up your plan again tomorrow',
              'Keep your cuisines and the things you avoid',
              'Open it on another device',
            ]}
            ctaLabel="Create free account"
          />
        </>
      ) : null}
    </div>
  );
}
