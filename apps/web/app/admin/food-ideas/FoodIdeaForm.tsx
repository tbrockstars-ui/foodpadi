'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AdminFoodIdea, BudgetTier } from './types';
import styles from './food-ideas.module.css';

const BUDGET_TIERS: { value: BudgetTier; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

interface Props {
  mode: 'create' | 'edit';
  initial?: AdminFoodIdea;
}

export function FoodIdeaForm({ mode, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? '');
  const [budgetTier, setBudgetTier] = useState<BudgetTier>(initial?.budgetTier ?? 'medium');
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(', ') ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const body = { title: title.trim(), description: description.trim(), cuisine: cuisine.trim(), budgetTier, tags };

    try {
      const res = await fetch(
        mode === 'create' ? '/api/admin-proxy/admin/food-ideas' : `/api/admin-proxy/admin/food-ideas/${initial!.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        setError(message ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      router.push('/admin/food-ideas');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin-proxy/admin/food-ideas/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      router.push('/admin/food-ideas');
      router.refresh();
    } catch {
      setError("Couldn't delete this food idea. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
        />
        {mode === 'create' ? (
          <p className={styles.hint}>
            The slug (stable id used by Eat Now&apos;s estimates) is generated from this automatically.
          </p>
        ) : (
          <p className={styles.hint}>Slug: {initial?.slug} (fixed — not editable once created).</p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          maxLength={500}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="cuisine">
          Cuisine
        </label>
        <input
          id="cuisine"
          className={styles.input}
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          required
          maxLength={60}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="budgetTier">
          Budget tier
        </label>
        <select
          id="budgetTier"
          className={styles.select}
          value={budgetTier}
          onChange={(e) => setBudgetTier(e.target.value as BudgetTier)}
        >
          {BUDGET_TIERS.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="tags">
          Tags
        </label>
        <input
          id="tags"
          className={styles.input}
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="spicy, quick, chicken"
        />
        <p className={styles.hint}>Comma-separated. Used by Eat Now&apos;s keyword matching.</p>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.formActions}>
        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create food idea' : 'Save changes'}
        </button>
        <Link href="/admin/food-ideas" className={styles.cancelLink}>
          Cancel
        </Link>
      </div>

      {mode === 'edit' ? (
        <div style={{ marginTop: 'var(--space-xl, 24px)' }}>
          {!confirmingDelete ? (
            <button
              type="button"
              className={styles.rowActionButtonDanger}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete this food idea
            </button>
          ) : (
            <div className={styles.confirmBox}>
              <p className={styles.confirmText}>
                This permanently deletes &quot;{initial?.title}&quot;. This can&apos;t be undone — use
                Deactivate on the list page instead if you just want to hide it from Eat Now.
              </p>
              <div className={styles.formActions} style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className={styles.rowActionButtonDanger}
                  onClick={remove}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button
                  type="button"
                  className={styles.cancelLink}
                  onClick={() => setConfirmingDelete(false)}
                  style={{ border: 'none', cursor: 'pointer', background: 'none', font: 'inherit' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </form>
  );
}
