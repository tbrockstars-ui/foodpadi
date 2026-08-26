'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanScope } from '@foodpadi/shared';
import styles from './plan.module.css';

const SCOPE_OPTIONS: { label: string; value: PlanScope }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Next 3 days', value: '3day' },
  { label: 'This week', value: 'week' },
  { label: 'Custom', value: 'custom' },
];

/** Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx's scope step. */
export function PlanScopeForm() {
  const router = useRouter();
  const [scope, setScope] = useState<PlanScope>('3day');
  const [customDays, setCustomDays] = useState('3');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createPlan = async () => {
    setError(null);
    if (scope === 'custom') {
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
          scope,
          customDays: scope === 'custom' ? Number(customDays) : undefined,
          budgetPence,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(message ?? 'Something went wrong creating your plan.');
      }
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
      <p className={styles.subtitle}>Pick what fits — you don&apos;t have to plan a whole week.</p>

      <div className={styles.chipWrap}>
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip} ${scope === option.value ? styles.chipSelected : ''}`}
            onClick={() => setScope(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {scope === 'custom' ? (
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Days (1-14)</label>
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
