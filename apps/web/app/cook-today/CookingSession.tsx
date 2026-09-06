'use client';

import { useEffect, useRef, useState } from 'react';
import { FEEDBACK_TAG_LABELS, FEEDBACK_TAGS, type RecipeView } from '@foodpadi/shared';
import styles from './cook-today.module.css';
import { CookingAssistantPanel } from './CookingAssistantPanel';
import { CookingTimer, type CookingTimerHandle } from './CookingTimer';
import { MemberBenefitCard } from '../../components/MemberBenefitCard';

// Best-effort duration hint from free-text step content — RecipeView.steps
// has no structured timing, so this only ever pre-fills CookingTimer's
// preset; it's never treated as authoritative.
function guessSeconds(stepText: string): number | undefined {
  const match = stepText.match(/(\d+)\s*(?:-|to)?\s*\d*\s*(minute|min|second|sec)/i);
  if (!match) return undefined;
  const value = parseInt(match[1], 10);
  if (Number.isNaN(value)) return undefined;
  return match[2].toLowerCase().startsWith('sec') ? value : value * 60;
}

const RATING_OPTIONS: { emoji: string; label: string; rating: number }[] = [
  { emoji: '❤️', label: 'Loved it', rating: 5 },
  { emoji: '🙂', label: 'Good', rating: 4 },
  { emoji: '😐', label: 'Okay', rating: 3 },
  { emoji: '👎', label: "Didn't like it", rating: 1 },
];

interface Props {
  recipe: RecipeView;
  /** Already-persisted recipe id (Saved Recipes) — skips the auto-save-on-entry step. */
  savedRecipeId?: string;
  isGuest: boolean;
  onClose: () => void;
}

/** Web counterpart to apps/mobile/src/screens/CookingSessionScreen.tsx. */
export function CookingSession({ recipe, savedRecipeId: initialSavedRecipeId, isGuest, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | undefined>(initialSavedRecipeId);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);
  const timerRef = useRef<CookingTimerHandle>(null);
  // Guards the auto-save below against firing twice — React Strict Mode
  // double-invokes effects in dev, and the `savedRecipeId` state guard alone
  // doesn't catch that (both invocations see the pre-update state), which
  // was creating two duplicate Recipe rows per cooking session.
  const autoSaveStarted = useRef(false);
  // Same double-invoke guard for the "mark cooked" call below.
  const markCookedStarted = useRef(false);

  // Rating needs a real Recipe.id — a freshly generated recipe has none yet,
  // so save it silently on entry for a signed-in cook. Fire-and-forget: a
  // failed background save must never block the cooking session itself.
  useEffect(() => {
    if (isGuest || savedRecipeId || autoSaveStarted.current) return;
    autoSaveStarted.current = true;
    fetch('/api/proxy/cook-today/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((saved: { id: string } | null) => {
        if (saved?.id) setSavedRecipeId(saved.id);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Recently cooked" engine, write side: the moment the cook reaches the
  // end of the steps, stamp Recipe.lastCookedAt — deliberately independent
  // of the optional rating below (see CookTodayService.markCooked).
  // Fire-and-forget, same precedent as the auto-save above: Home simply
  // won't show this cook if it fails, nothing here should block the "How
  // did it go?" screen.
  useEffect(() => {
    if (!finished || isGuest || !savedRecipeId || markCookedStarted.current) return;
    markCookedStarted.current = true;
    fetch(`/api/proxy/cook-today/recipes/${savedRecipeId}/cooked`, { method: 'POST' }).catch(() => undefined);
  }, [finished, isGuest, savedRecipeId]);

  const totalSteps = recipe.steps.length;
  const isLastStep = stepIndex === totalSteps - 1;

  const goNext = () => {
    if (isLastStep) {
      setFinished(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const pickRating = async (rating: number) => {
    setSelectedRating(rating);
    if (isGuest || !savedRecipeId) return;
    setSubmittingRating(true);
    try {
      const res = await fetch('/api/proxy/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'RECIPE', entityId: savedRecipeId, context: 'COOK', rating }),
      });
      if (res.ok) {
        const feedback = (await res.json()) as { id: string };
        setFeedbackId(feedback.id);
      }
    } catch {
      // Non-blocking — the cook already finished, don't strand them here.
    } finally {
      setSubmittingRating(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  };

  const saveTags = async () => {
    if (feedbackId && selectedTags.length > 0) {
      try {
        await fetch(`/api/proxy/feedback/${feedbackId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: selectedTags }),
        });
      } catch {
        // Non-blocking — the rating itself already saved.
      }
    }
    onClose();
  };

  if (finished) {
    return (
      <div>
        <h1 className={styles.title}>How did it go?</h1>
        <p className={styles.subtitle}>{recipe.title}</p>

        <div className={styles.ratingRow}>
          {RATING_OPTIONS.map((option) => (
            <button
              key={option.rating}
              type="button"
              className={`${styles.ratingButton} ${selectedRating === option.rating ? styles.ratingButtonSelected : ''}`}
              onClick={() => pickRating(option.rating)}
              disabled={submittingRating}
            >
              <span className={styles.ratingEmoji}>{option.emoji}</span>
              <span className={styles.ratingLabel}>{option.label}</span>
            </button>
          ))}
        </div>

        {selectedRating !== null ? (
          isGuest ? (
            <MemberBenefitCard
              icon="🧠"
              title="Want FoodPadi to remember this?"
              body="Create a free account and FoodPadi remembers this recipe — and what you thought of it — for next time."
              ctaLabel="Create free account"
            />
          ) : feedbackId ? (
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <p className={styles.sectionHeading}>
                {selectedRating !== null && selectedRating >= 4 ? 'What made it good?' : 'What should we change next time?'}
              </p>
              <div className={styles.chipWrap}>
                {(selectedRating !== null && selectedRating >= 4
                  ? FEEDBACK_TAGS.RECIPE.positive
                  : FEEDBACK_TAGS.RECIPE.negative
                ).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`${styles.chip} ${selectedTags.includes(tag) ? styles.chipSelected : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {FEEDBACK_TAG_LABELS[tag] ?? tag}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <button type="button" className={styles.primaryButton} onClick={saveTags}>
                  Done
                </button>
              </div>
            </div>
          ) : null
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className={styles.secondaryButton} onClick={onClose} style={{ marginBottom: 16 }}>
        ‹ Cancel
      </button>
      <h1 className={styles.title}>
        Step {stepIndex + 1} of {totalSteps}
      </h1>
      <p className={styles.subtitle}>{recipe.title}</p>

      <p className={styles.stepGuideText}>{recipe.steps[stepIndex]}</p>

      <CookingTimer key={stepIndex} ref={timerRef} suggestedSeconds={guessSeconds(recipe.steps[stepIndex])} />

      <div className={styles.navRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
        >
          Back
        </button>
        <button type="button" className={styles.primaryButton} onClick={goNext}>
          {isLastStep ? 'Finish Cooking' : "I'm Ready"}
        </button>
      </div>

      {!isGuest ? (
        <CookingAssistantPanel
          recipe={recipe}
          stepIndex={stepIndex}
          isLastStep={isLastStep}
          timerRef={timerRef}
          onNext={goNext}
          onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
          onFinish={() => setFinished(true)}
        />
      ) : null}
    </div>
  );
}
