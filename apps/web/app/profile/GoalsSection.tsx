'use client';

import { useState } from 'react';
import { FOOD_GOALS, FoodGoal, FoodGoalItem, MAX_FOOD_GOALS } from '@foodpadi/shared';
import styles from './profile.module.css';

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

export function GoalsSection({ initialGoals }: { initialGoals: FoodGoalItem[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<FoodGoal[]>(initialGoals.map((g) => g.goalType));
  const [primary, setPrimary] = useState<FoodGoal | null>(
    initialGoals.find((g) => g.isPrimary)?.goalType ?? null,
  );
  const [personalNote, setPersonalNote] = useState(
    initialGoals.find((g) => g.goalType === 'personal')?.note ?? '',
  );
  const [saving, setSaving] = useState(false);
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

  const startEditing = () => {
    setSelected(goals.map((g) => g.goalType));
    setPrimary(goals.find((g) => g.isPrimary)?.goalType ?? null);
    setPersonalNote(goals.find((g) => g.goalType === 'personal')?.note ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (selected.length > 1 && !primary) {
      setError('Pick a main priority.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/users/me/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalTypes: selected,
          primaryGoalType: primary ?? selected[0],
          personalGoalNote: selected.includes('personal') ? personalNote.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGoals(data.goals);
      setEditing(false);
    } catch {
      setError("Couldn't save your goals. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div>
        {goals.length === 0 ? (
          <p className={styles.emptyText}>No goals set yet.</p>
        ) : (
          <div className={styles.tagList}>
            {goals.map((goal) => (
              <span key={goal.goalType} className={styles.removableTag}>
                {GOAL_LABELS[goal.goalType]}
                {goal.isPrimary && goals.length > 1 ? ' ★' : ''}
              </span>
            ))}
          </div>
        )}
        <button type="button" className={styles.secondaryButton} onClick={startEditing}>
          Edit goals
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className={styles.emptyText}>Choose up to {MAX_FOOD_GOALS}.</p>
      <div className={styles.chipWrap}>
        {SELECTABLE_GOALS.map((goal) => (
          <button
            key={goal}
            type="button"
            className={`${styles.chip} ${selected.includes(goal) ? styles.chipSelected : ''}`}
            onClick={() => toggle(goal)}
            disabled={saving}
          >
            {GOAL_LABELS[goal]}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.chip} ${selected.includes('none') ? styles.chipSelected : ''}`}
          onClick={() => toggle('none')}
          disabled={saving}
        >
          {GOAL_LABELS.none}
        </button>
      </div>

      {selected.includes('personal') ? (
        <div className={styles.addRow} style={{ marginBottom: 'var(--space-md)' }}>
          <input
            className={styles.addInput}
            placeholder="Tell us about your goal"
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            maxLength={140}
          />
        </div>
      ) : null}

      {selected.length > 1 ? (
        <>
          <p className={styles.emptyText}>Which is your main priority?</p>
          <div className={styles.chipWrap}>
            {selected.map((goal) => (
              <button
                key={goal}
                type="button"
                className={`${styles.chip} ${primary === goal ? styles.chipSelected : ''}`}
                onClick={() => setPrimary(goal)}
                disabled={saving}
              >
                {GOAL_LABELS[goal]}
                {primary === goal ? ' ★' : ''}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <div className={styles.buttonRow}>
        <button type="button" className={styles.primaryButton} onClick={save} disabled={saving || selected.length === 0}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
