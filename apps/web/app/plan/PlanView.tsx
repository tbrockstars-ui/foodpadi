'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MealPlanView } from '@foodpadi/shared';
import styles from './plan.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx's plan step. */
export function PlanView({ plan }: { plan: MealPlanView }) {
  const router = useRouter();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [creatingList, setCreatingList] = useState(false);

  const regenerate = async (itemId: string) => {
    setBusyItemId(itemId);
    try {
      await fetch(`/api/proxy/plan-ahead/${plan.id}/items/${itemId}/regenerate`, { method: 'POST' });
      router.refresh();
    } finally {
      setBusyItemId(null);
    }
  };

  const remove = async (itemId: string) => {
    setBusyItemId(itemId);
    try {
      await fetch(`/api/proxy/plan-ahead/${plan.id}/items/${itemId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusyItemId(null);
    }
  };

  const accept = async () => {
    setAccepting(true);
    try {
      await fetch(`/api/proxy/plan-ahead/${plan.id}/accept`, { method: 'POST' });
      router.refresh();
    } finally {
      setAccepting(false);
    }
  };

  const createShoppingList = async () => {
    setCreatingList(true);
    try {
      const res = await fetch(`/api/proxy/plan-ahead/${plan.id}/shopping-list`, { method: 'POST' });
      const list = (await res.json()) as { id: string };
      router.push(`/shopping-list/${list.id}`);
    } finally {
      setCreatingList(false);
    }
  };

  return (
    <div>
      <h1 className={styles.title}>Your plan</h1>
      <p className={styles.subtitle}>
        {plan.status === 'accepted' ? 'Accepted — ready for shopping.' : "Review it, then accept when you're happy."}
      </p>

      {plan.items.map((item) => (
        <div key={item.id} className={styles.mealCard}>
          <p className={styles.mealDate}>{formatDate(item.plannedDate)}</p>
          {item.recipe ? (
            <>
              <p className={styles.mealTitle}>{item.recipe.title}</p>
              <div className={styles.tagRow}>
                <span className={styles.tag}>{item.recipe.cookTimeMinutes} min</span>
                <span className={styles.tag}>{item.recipe.servings} servings</span>
                {item.recipe.cuisine ? <span className={styles.tag}>{item.recipe.cuisine}</span> : null}
              </div>
            </>
          ) : (
            <p className={styles.mealTitle}>Nothing planned for this day</p>
          )}
          {plan.status === 'draft' ? (
            <div className={styles.itemActions}>
              <button
                type="button"
                className={styles.itemActionText}
                onClick={() => regenerate(item.id)}
                disabled={busyItemId === item.id}
              >
                {busyItemId === item.id ? 'Working…' : 'Regenerate'}
              </button>
              <button
                type="button"
                className={styles.itemActionTextDanger}
                onClick={() => remove(item.id)}
                disabled={busyItemId === item.id}
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      ))}

      {plan.status === 'draft' ? (
        <button type="button" className={styles.primaryButton} onClick={accept} disabled={accepting}>
          {accepting ? 'Working…' : 'Accept plan'}
        </button>
      ) : (
        <button type="button" className={styles.primaryButton} onClick={createShoppingList} disabled={creatingList}>
          {creatingList ? 'Working…' : 'Create shopping list'}
        </button>
      )}
    </div>
  );
}
