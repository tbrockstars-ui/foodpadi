'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MealPlanView } from '@foodpadi/shared';
import { getCuisineImage } from '../../lib/imageAssets';
import styles from './plan.module.css';

const SUGGESTION_DEBOUNCE_MS = 300;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Web counterpart to apps/mobile/src/screens/PlanAheadScreen.tsx's plan step. */
export function PlanView({ plan }: { plan: MealPlanView }) {
  const router = useRouter();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-day "replace with something specific": which day's box is open, and
  // the drafted prompt text for each, keyed by item id.
  const [focusOpenId, setFocusOpenId] = useState<string | null>(null);
  const [focusDrafts, setFocusDrafts] = useState<Record<string, string>>({});
  // Typeahead for the currently-open box only — a dish-name picker instead
  // of free-typing a hint and finding out only after submitting whether
  // anything matched. Scoped to one box at a time (only one is ever open),
  // so this doesn't need to be keyed by item id like focusDrafts is.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestionsAbortRef = useRef<AbortController | null>(null);

  const focusDraft = focusOpenId ? (focusDrafts[focusOpenId] ?? '') : '';

  // Debounced fetch of suggestions as the user types in the open box.
  useEffect(() => {
    if (!focusOpenId || !focusDraft.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      suggestionsAbortRef.current?.abort();
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;
      try {
        const res = await fetch(`/api/proxy/plan-ahead/meal-ideas?q=${encodeURIComponent(focusDraft.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as string[];
        setSuggestions(data);
      } catch {
        // Aborted (a newer keystroke superseded this request) or a network
        // blip — either way, just leave whatever suggestions are already
        // showing rather than surfacing an error for a background typeahead.
      }
    }, SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOpenId, focusDraft]);

  const readError = async (res: Response, fallback: string) => {
    const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    return Array.isArray(data.message) ? data.message.join('. ') : data.message ?? fallback;
  };

  const regenerate = async (itemId: string, focus?: string) => {
    setBusyItemId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/plan-ahead/${plan.id}/items/${itemId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(focus ? { focus } : {}),
      });
      if (!res.ok) {
        setError(await readError(res, 'Could not replace that day. Please try again.'));
        return;
      }
      setFocusOpenId(null);
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

  const regeneratePlan = async () => {
    setRegeneratingPlan(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/plan-ahead/${plan.id}/regenerate`, { method: 'POST' });
      if (!res.ok) {
        setError(await readError(res, 'Could not rebuild the plan. Please try again.'));
        return;
      }
      router.refresh();
    } finally {
      setRegeneratingPlan(false);
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

  const createShoppingList = async (regenerateList = false) => {
    setCreatingList(true);
    try {
      const res = await fetch(`/api/proxy/plan-ahead/${plan.id}/shopping-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: regenerateList }),
      });
      const list = (await res.json()) as { id: string };
      router.push(`/shopping-list/${list.id}`);
    } finally {
      setCreatingList(false);
    }
  };

  const planLevelLabel = plan.scope === 'tomorrow' ? 'Replace this day-plan' : 'Replace whole plan';

  return (
    <div>
      <h1 className={styles.title}>Your plan</h1>
      <p className={styles.subtitle}>
        {plan.status === 'accepted' ? 'Accepted — ready for shopping.' : "Review it, then accept when you're happy."}
      </p>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {plan.items.map((item) => {
        const image = item.recipe ? getCuisineImage(item.recipe.cuisine) : null;
        return (
          <div key={item.id} className={styles.mealCard}>
            {image ? <img className={styles.mealImage} src={image.url} alt={image.alt} /> : null}
            <div className={styles.mealContent}>
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
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.itemActionText}
                  onClick={() => regenerate(item.id)}
                  disabled={busyItemId === item.id}
                >
                  {busyItemId === item.id && focusOpenId !== item.id ? 'Working…' : 'Replace this day'}
                </button>
                <button
                  type="button"
                  className={styles.itemActionText}
                  onClick={() => {
                    setSuggestions([]);
                    setFocusOpenId(focusOpenId === item.id ? null : item.id);
                  }}
                  disabled={busyItemId === item.id}
                >
                  {focusOpenId === item.id ? 'Cancel' : 'Replace with something specific'}
                </button>
                {/* Removing a day (vs. swapping it) only makes sense before the
                    plan is accepted — an accepted plan's shopping list is built
                    from the full day list, so cutting a day at that point is a
                    bigger, more disruptive edit than the brief asked for here. */}
                {plan.status === 'draft' ? (
                  <button
                    type="button"
                    className={styles.itemActionTextDanger}
                    onClick={() => remove(item.id)}
                    disabled={busyItemId === item.id}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              {focusOpenId === item.id ? (
                <div className={styles.focusRow}>
                  <div className={styles.focusWrap}>
                    <input
                      className={styles.focusInput}
                      type="text"
                      autoFocus
                      placeholder="e.g. pizza, a quick pasta"
                      autoComplete="off"
                      value={focusDrafts[item.id] ?? ''}
                      onChange={(e) => setFocusDrafts((cur) => ({ ...cur, [item.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') regenerate(item.id, (focusDrafts[item.id] ?? '').trim() || undefined);
                        if (e.key === 'Escape') setSuggestions([]);
                      }}
                    />
                    {suggestions.length > 0 ? (
                      <div className={styles.suggestionsList} role="listbox">
                        {suggestions.map((title) => (
                          <button
                            key={title}
                            type="button"
                            role="option"
                            aria-selected={false}
                            className={styles.suggestionItem}
                            // onMouseDown (not onClick) fires before the input's
                            // onBlur, so the pick registers before the list would
                            // otherwise vanish out from under the click.
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFocusDrafts((cur) => ({ ...cur, [item.id]: title }));
                              setSuggestions([]);
                              regenerate(item.id, title);
                            }}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.focusButton}
                    onClick={() => regenerate(item.id, (focusDrafts[item.id] ?? '').trim() || undefined)}
                    disabled={busyItemId === item.id || !(focusDrafts[item.id] ?? '').trim()}
                  >
                    {busyItemId === item.id ? 'Working…' : 'Replace'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className={styles.planActionsRow}>
        <button
          type="button"
          className={styles.itemActionText}
          onClick={regeneratePlan}
          disabled={regeneratingPlan}
        >
          {regeneratingPlan ? 'Rebuilding…' : planLevelLabel}
        </button>
        <Link href="/plan?new=1" className={styles.itemActionText}>
          Start a new plan
        </Link>
      </div>

      {plan.status === 'draft' ? (
        <button type="button" className={styles.primaryButton} onClick={accept} disabled={accepting}>
          {accepting ? 'Working…' : 'Accept plan'}
        </button>
      ) : plan.shoppingListId ? (
        <div className={styles.listActions}>
          <Link href={`/shopping-list/${plan.shoppingListId}`} className={styles.primaryButton}>
            View shopping list
          </Link>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => createShoppingList(true)}
            disabled={creatingList}
          >
            {creatingList ? 'Working…' : 'Rebuild list from plan'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => createShoppingList(false)}
          disabled={creatingList}
        >
          {creatingList ? 'Working…' : 'Create shopping list'}
        </button>
      )}
    </div>
  );
}
