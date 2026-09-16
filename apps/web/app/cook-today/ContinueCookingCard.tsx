'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CookingJourneyView } from '@foodpadi/shared';
import { summariseIngredientCheck } from '@foodpadi/shared';
import styles from './ContinueCookingCard.module.css';

/**
 * "Continue where you left off" — shown at the top of the Cook page's input
 * step whenever the signed-in user has an active Cooking Journey (docs
 * cooking-journey brief §14/§16/§36 State B), so they never see the blank
 * "What do you want to cook?" as if nothing happened.
 *
 * Self-contained: the `shopping` state is a plain link to the journey's
 * shopping list; every other state calls `onResume()`, which the parent
 * (CookTodayForm) turns into re-entering its existing detail/cooking render
 * with the journey's recipe + step. "Start something else" is a two-step
 * confirm — the current journey is never silently replaced (§17).
 */
export function ContinueCookingCard({
  journey,
  onResume,
  onStartSomethingElse,
}: {
  journey: CookingJourneyView;
  onResume: () => void;
  onStartSomethingElse: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const { line, cta } = describe(journey);
  const shoppingListId = journey.shoppingList?.id;

  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Continue where you left off</p>
      <p className={styles.title}>{journey.recipe.title}</p>
      <p className={styles.line}>{line}</p>

      {journey.destination === 'shopping' && shoppingListId ? (
        <Link href={`/shopping-list/${shoppingListId}`} className={styles.primary}>
          {cta}
        </Link>
      ) : (
        <button type="button" className={styles.primary} onClick={onResume}>
          {cta}
        </button>
      )}

      {confirming ? (
        <div className={styles.confirmRow}>
          <p className={styles.confirmText}>
            You&apos;re already cooking {journey.recipe.title}. Starting another meal will replace this
            cooking journey.
          </p>
          <div className={styles.confirmButtons}>
            <button type="button" className={styles.secondary} onClick={() => setConfirming(false)}>
              Keep {journey.recipe.title}
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={() => {
                setConfirming(false);
                onStartSomethingElse();
              }}
            >
              Start new meal
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.startElse} onClick={() => setConfirming(true)}>
          Start something else
        </button>
      )}
    </section>
  );
}

function describe(journey: CookingJourneyView): { line: string; cta: string } {
  const total = journey.recipe.steps.length;
  switch (journey.destination) {
    case 'cooking': {
      const remaining = journey.timer?.remainingSeconds;
      const timerNote =
        remaining && remaining > 0 ? ` · ${formatMMSS(remaining)} on the timer` : '';
      return { line: `Step ${journey.currentStep + 1} of ${total}${timerNote}`, cta: 'Continue cooking' };
    }
    case 'shopping': {
      const left = journey.shoppingList
        ? journey.shoppingList.itemsTotal - journey.shoppingList.itemsChecked
        : 0;
      return {
        line: left > 0 ? `Shopping · ${left} item${left === 1 ? '' : 's'} left` : 'Shopping',
        cta: 'View shopping list',
      };
    }
    case 'ready_to_cook':
      return {
        line: `Ready to cook · about ${journey.recipe.cookTimeMinutes} min`,
        cta: 'Start cooking',
      };
    case 'ingredient_check': {
      const s = journey.ingredientState;
      if (s && s.subStage === 'reviewScan' && s.detected.length > 0) {
        const { kept, detectedCount } = summariseIngredientCheck(s);
        return {
          line: `Kitchen check in progress · ${kept} of ${detectedCount} kept`,
          cta: 'Continue review',
        };
      }
      if (s && s.subStage === 'reconciled') {
        const { haveCount, needCount } = summariseIngredientCheck(s);
        return {
          line: `Kitchen check done · ${haveCount} you have, ${needCount} to buy`,
          cta: 'Continue',
        };
      }
      return { line: 'Checking what you have', cta: 'Continue' };
    }
    case 'feedback_pending':
      return { line: 'Finished cooking — rate it?', cta: 'Rate meal' };
    case 'recipe_selected':
    default:
      return { line: 'Recipe selected', cta: 'Continue' };
  }
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
