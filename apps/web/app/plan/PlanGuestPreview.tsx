'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlanPreviewResponse } from '@foodpadi/shared';
import styles from './plan.module.css';
import { MemberBenefitCard } from '../../components/MemberBenefitCard';

// A guest can only preview tomorrow — planning further ahead is what a free
// account unlocks, so the longer scopes are shown but locked, and choosing
// one asks the guest to register rather than doing nothing.
const SCOPES: { label: string; days: number; guestAllowed: boolean }[] = [
  { label: 'Just tomorrow', days: 1, guestAllowed: true },
  { label: '3 days', days: 3, guestAllowed: false },
  { label: 'This week', days: 7, guestAllowed: false },
];

const LOCKED_HINT = 'Create a free account to plan more than tomorrow';

/**
 * Guest / signed-out Plan Ahead — an AI-free preview from the curated recipe
 * pool (GET /plan-ahead/preview). Nothing is saved; a real plan with
 * reminders and per-day edits needs a free account. Web counterpart of
 * apps/mobile/src/screens/PlanAheadGuestPreview.tsx.
 */
export function PlanGuestPreview() {
  const [days, setDays] = useState(1);
  const [preview, setPreview] = useState<PlanPreviewResponse['days'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLockedNudge, setShowLockedNudge] = useState(false);

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

  const pickScope = (scope: (typeof SCOPES)[number]) => {
    if (!scope.guestAllowed) {
      setShowLockedNudge(true);
      return;
    }
    setShowLockedNudge(false);
    setDays(scope.days);
    if (preview) void load(scope.days);
  };

  return (
    <div>
      <h1 className={styles.title}>Plan your next few meals</h1>
      <p className={styles.subtitle}>A preview of how Plan Ahead works — no account needed to look around.</p>

      <div className={styles.chipWrap}>
        {SCOPES.map((s) => {
          const locked = !s.guestAllowed;
          const selected = days === s.days && !locked;
          return (
            <button
              key={s.days}
              type="button"
              className={`${styles.chip} ${selected ? styles.chipSelected : ''} ${locked ? styles.chipLocked : ''}`}
              onClick={() => pickScope(s)}
              aria-disabled={locked}
              title={locked ? LOCKED_HINT : undefined}
            >
              {locked ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : null}
              {s.label}
            </button>
          );
        })}
      </div>

      {showLockedNudge ? (
        <p className={styles.lockedNudge}>
          Planning more than tomorrow needs a free account.{' '}
          <Link href="/register">Create one</Link> to plan up to a full week.
        </p>
      ) : null}

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
