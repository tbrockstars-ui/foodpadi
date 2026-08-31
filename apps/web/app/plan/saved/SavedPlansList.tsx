'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MealPlanView, PlanScope } from '@foodpadi/shared';
import styles from '../plan.module.css';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function scopeLabel(scope: PlanScope, dayCount: number): string {
  switch (scope) {
    case 'tomorrow':
      return 'Next day';
    case 'today':
      return 'Today';
    case 'week':
      return 'This week';
    case '3day':
      return '3 days';
    default:
      return `${dayCount} day${dayCount === 1 ? '' : 's'}`;
  }
}

export function SavedPlansList({ initialPlans }: { initialPlans: MealPlanView[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const removePlan = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/proxy/plan-ahead/${id}`, { method: 'DELETE' });
      setPlans((cur) => cur.filter((p) => p.id !== id));
      if (expandedId === id) setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (plans.length === 0) {
    return (
      <p className={styles.emptyText}>
        No plans yet — create one in Plan Ahead and it&apos;ll be saved here automatically.
      </p>
    );
  }

  return (
    <>
      {plans.map((plan) => {
        const expanded = expandedId === plan.id;
        return (
          <div key={plan.id} className={styles.savedCard}>
            <button
              type="button"
              className={styles.savedHeader}
              onClick={() => setExpandedId(expanded ? null : plan.id)}
            >
              <p className={styles.savedTitle}>
                {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
              </p>
              <div className={styles.tagRow}>
                <span className={styles.tag}>{scopeLabel(plan.scope, plan.items.length)}</span>
                <span className={styles.tag}>
                  {plan.items.length} meal{plan.items.length === 1 ? '' : 's'}
                </span>
                {plan.status === 'accepted' ? <span className={styles.tag}>Accepted</span> : null}
              </div>
            </button>

            {expanded ? (
              <div className={styles.savedDetail}>
                {plan.items.map((item) => (
                  <div key={item.id} className={styles.savedDayRow}>
                    <span className={styles.savedDayDate}>{formatDate(item.plannedDate)}</span>
                    <span className={styles.savedDayMeal}>
                      {item.recipe ? item.recipe.title : 'Nothing planned'}
                    </span>
                  </div>
                ))}

                <div className={styles.savedActions}>
                  {plan.shoppingListId ? (
                    <Link href={`/shopping-list/${plan.shoppingListId}`} className={styles.itemActionText}>
                      View shopping list
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => removePlan(plan.id)}
                    disabled={deletingId === plan.id}
                  >
                    {deletingId === plan.id ? 'Removing…' : 'Delete plan'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
