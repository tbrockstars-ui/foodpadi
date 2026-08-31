'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanScope } from '@foodpadi/shared';
import styles from './plan.module.css';

// Two primary choices — plan just the next day, or the whole week. Anything
// in between lives behind "More options" as a custom day count (1-14).
const SCOPE_OPTIONS: { label: string; value: PlanScope }[] = [
  { label: 'Just tomorrow', value: 'tomorrow' },
  { label: 'This week', value: 'week' },
];

/** Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx's scope step. */
export function PlanScopeForm() {
  const router = useRouter();
  const [scope, setScope] = useState<PlanScope>('week');
  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState('3');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveScope: PlanScope = showCustom ? 'custom' : scope;

  const createPlan = async () => {
    setError(null);
    if (effectiveScope === 'custom') {
      const parsed = Number(customDays);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 14) {
        setError('Enter a number of days between 1 and 14.');
        return;
      }
    }
    setLoading(true);
    try {
      const budgetPence = budget.trim() ? Math.round(parseFloat(budget) * 100) : undefined;
      const res = await fetch('/api/proxy/plan-ahead/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: effectiveScope,
          customDays: effectiveScope === 'custom' ? Number(customDays) : undefined,
          budgetPence,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(message ?? 'Something went wrong creating your plan.');
      }
      // Land on the plan (clears any ?new=1) rather than staying on the form.
      router.push('/plan');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong creating your plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className={styles.title}>How far ahead?</h1>
      <p className={styles.subtitle}>Plan just the next day, or the whole week.</p>

      <div className={styles.chipWrap}>
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip} ${!showCustom && scope === option.value ? styles.chipSelected : ''}`}
            onClick={() => {
              setShowCustom(false);
              setScope(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.chip} ${showCustom ? styles.chipSelected : ''}`}
          onClick={() => setShowCustom((v) => !v)}
        >
          More options
        </button>
      </div>

      {showCustom ? (
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Number of days (1-14)</label>
          <input
            className={styles.smallInput}
            type="number"
            min={1}
            max={14}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
          />
        </div>
      ) : null}

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Weekly budget (optional)</label>
        <input
          className={styles.smallInput}
          type="text"
          placeholder="£70"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <button type="button" className={styles.primaryButton} onClick={createPlan} disabled={loading}>
        {loading ? 'Building your plan…' : 'Create my plan'}
      </button>
    </div>
  );
}
