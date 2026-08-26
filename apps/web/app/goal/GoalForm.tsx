'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FOOD_GOALS, FoodGoal, MAX_FOOD_GOALS } from '@foodpadi/shared';
import styles from '../onboarding.module.css';

const GOAL_LABELS: Record<FoodGoal, string> = {
  balanced_meals: 'Eat more balanced meals',
  support_fitness: 'Support my fitness',
  maintain_weight: 'Maintain my current weight',
  reduce_spending: 'Reduce food spending',
  reduce_waste: 'Reduce food waste',
  home_cooked: 'Eat more home-cooked meals',
  explore_cuisines: 'Explore new foods',
  personal: 'Personal goal',
  none: 'No particular goal',
};

const SELECTABLE_GOALS = FOOD_GOALS.filter((g) => g !== 'none');

/** Web counterpart to apps/mobile/src/components/goals/GoalsEditor.tsx (onboarding entry only). */
export function GoalForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<'select' | 'primary'>('select');
  const [selected, setSelected] = useState<FoodGoal[]>([]);
  const [primary, setPrimary] = useState<FoodGoal | null>(null);
  const [personalNote, setPersonalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (goal: FoodGoal) => {
    setError(null);
    if (goal === 'none') {
      setSelected(selected.includes('none') ? [] : ['none']);
      setPrimary(selected.includes('none') ? null : 'none');
      return;
    }
    if (selected.includes(goal)) {
      const next = selected.filter((g) => g !== goal);
      setSelected(next);
      setPrimary((current) => (next.length === 1 ? next[0] : current && next.includes(current) ? current : null));
      return;
    }
    const withoutNone = selected.filter((g) => g !== 'none');
    if (withoutNone.length >= MAX_FOOD_GOALS) return;
    const next = [...withoutNone, goal];
    setSelected(next);
    setPrimary(next.length === 1 ? next[0] : null);
  };

  const submit = async (primaryOverride?: FoodGoal) => {
    const primaryGoalType = primaryOverride ?? primary ?? selected[0];
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/users/me/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalTypes: selected,
          primaryGoalType,
          personalGoalNote: selected.includes('personal') ? personalNote.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      router.push('/preferences');
    } catch {
      setError("Couldn't save your goals. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    if (selected.length === 1) {
      submit(selected[0]);
      return;
    }
    if (primary && selected.includes(primary)) {
      submit(primary);
      return;
    }
    setPhase('primary');
  };

  const skip = () => router.push('/preferences');

  if (phase === 'primary') {
    return (
      <div>
        <h1 className={styles.heading}>Which is your main priority?</h1>
        <p className={styles.subtitle}>FoodPadi will use this first when your goals compete.</p>
        <div className={styles.chipWrap}>
          {selected.map((goal) => (
            <button
              key={goal}
              type="button"
              className={`${styles.chip} ${primary === goal ? styles.chipSelected : ''}`}
              onClick={() => setPrimary(goal)}
              disabled={submitting}
            >
              {GOAL_LABELS[goal]}
              {primary === goal ? ' ★' : ''}
            </button>
          ))}
        </div>
        {error ? <p className={styles.errorText}>{error}</p> : null}
        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondaryButton} onClick={() => setPhase('select')} disabled={submitting}>
            Back
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => submit()} disabled={!primary || submitting}>
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.heading}>What are your food & lifestyle goals?</h1>
      <p className={styles.subtitle}>Choose up to {MAX_FOOD_GOALS}. You can change these anytime.</p>
      {selected.length > 0 ? (
        <p className={styles.counter}>
          {selected.length} of {MAX_FOOD_GOALS} selected
        </p>
      ) : null}

      <div className={styles.chipWrap}>
        {SELECTABLE_GOALS.map((goal) => (
          <div key={goal} style={{ width: '100%' }}>
            <button
              type="button"
              className={`${styles.chip} ${selected.includes(goal) ? styles.chipSelected : ''}`}
              onClick={() => toggle(goal)}
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {GOAL_LABELS[goal]}
            </button>
            {goal === 'personal' && selected.includes('personal') ? (
              <div className={styles.noteBox}>
                <p className={styles.noteLabel}>Tell us about your goal</p>
                <textarea
                  className={styles.noteInput}
                  placeholder="e.g. Make weekday meals easier"
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  maxLength={140}
                />
                <p className={styles.helperText}>Keep it food or lifestyle related.</p>
              </div>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className={`${styles.chip} ${selected.includes('none') ? styles.chipSelected : ''}`}
          onClick={() => toggle('none')}
          disabled={submitting}
          style={{ width: '100%' }}
        >
          {GOAL_LABELS.none}
        </button>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <div className={styles.buttonRow}>
        <button type="button" className={styles.primaryButton} onClick={handleContinue} disabled={selected.length === 0 || submitting}>
          {submitting ? 'Saving…' : 'Continue'}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={skip} disabled={submitting}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
