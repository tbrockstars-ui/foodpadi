'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { COOKING_EXPERIENCE_TAGS, FEEDBACK_TAG_LABELS, FEEDBACK_TAGS, type RecipeView } from '@foodpadi/shared';
import styles from './cook-today.module.css';
import { CookingAssistantPanel } from './CookingAssistantPanel';
import { CookingTimer, type CookingTimerHandle } from './CookingTimer';
import { MemberBenefitCard } from '../../components/MemberBenefitCard';
import { trackClientEvent } from '../../lib/trackClientEvent';

// Best-effort duration hint from free-text step content — used only when the
// recipe has no structured stepDurationsSeconds at all (guest/curated/Plan
// Ahead-sourced recipes, or an older saved recipe from before this field
// existed). Never treated as authoritative.
function guessSeconds(stepText: string): number | undefined {
  const match = stepText.match(/(\d+)\s*(?:-|to)?\s*\d*\s*(minute|min|second|sec)/i);
  if (!match) return undefined;
  const value = parseInt(match[1], 10);
  if (Number.isNaN(value)) return undefined;
  return match[2].toLowerCase().startsWith('sec') ? value : value * 60;
}

// Prefers the AI's own structured per-step duration (real, requested at
// generation time — see COOK_TODAY_SYSTEM_PROMPT/recipe-validation.ts) over
// the text-guess above. `undefined` means neither source has a genuine
// per-step figure — computeStepDurations below is what turns that into an
// actual timer.
function durationForStep(recipe: RecipeView, stepIndex: number): number | undefined {
  if (recipe.stepDurationsSeconds) {
    return recipe.stepDurationsSeconds[stepIndex] ?? undefined;
  }
  return guessSeconds(recipe.steps[stepIndex]);
}

// Every step should run its own timer and auto-advance — "Start Cooking"
// drives the whole recipe, not just the steps that happened to have an
// AI-provided or text-guessed duration. A step with a genuine per-step figure
// (durationForStep) keeps it exactly; a step with neither gets this flat
// estimate instead.
//
// Deliberately NOT derived from the recipe's own advertised cookTimeMinutes
// (an earlier version split whatever was "left" of that total across the
// unmeasured steps, which could squeeze one down to a near-nothing sliver
// whenever the other steps already accounted for the whole total on their
// own). Every step's estimate now stands on its own — the recipe's overall
// guided-cook time is simply whatever they add up to (plus the transition
// pauses below), not the other way around, so it's never silently smaller
// than the sum of its own parts.
const DEFAULT_ESTIMATED_STEP_SECONDS = 90;

function computeStepDurations(recipe: RecipeView): number[] {
  return recipe.steps.map((_, i) => durationForStep(recipe, i) ?? DEFAULT_ESTIMATED_STEP_SECONDS);
}

// Fixed pause between steps once one finishes (timer running out, or the
// cook marking it done early) — gives a moment to actually move to the next
// bit of the recipe before its timer starts, instead of snapping straight
// into it. Not applied after the last step (there's nothing to transition
// into — that's the "How did it go?" screen instead).
const STEP_TRANSITION_SECONDS = 30;

// Same lightweight same-tab persistence idea as CookTodayForm.tsx's own
// session key — just the step position, not the exact timer second (a
// refreshed step's timer restarts fresh rather than trying to resume an
// exact countdown, which needs no new mechanism beyond CookingTimer's
// existing auto-start).
const STEP_KEY = 'foodpadi.cookToday.stepIndex';

function loadPersistedStepIndex(totalSteps: number): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(STEP_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed >= 0 && parsed < totalSteps ? parsed : 0;
  } catch {
    return 0;
  }
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
  /** The active Cooking Journey this session belongs to (docs cooking-journey
      brief). When set, step position / completion / timer are mirrored to the
      server so a logout or app close resumes exactly here. */
  journeyId?: string;
  /** Resume position from the journey — wins over the sessionStorage copy. */
  initialStepIndex?: number;
  /** Seconds left on the resumed step's server timer, if one was running. */
  initialTimerRemainingSeconds?: number;
  /** Resume straight into the "how did it go?" rating screen (journey stage
      was already feedback_pending). */
  initialFinished?: boolean;
}

/** Web counterpart to apps/mobile/src/screens/CookingSessionScreen.tsx. */
export function CookingSession({
  recipe,
  savedRecipeId: initialSavedRecipeId,
  isGuest,
  onClose,
  journeyId,
  initialStepIndex,
  initialTimerRemainingSeconds,
  initialFinished = false,
}: Props) {
  // Always starts at 0 — sessionStorage doesn't exist during SSR, so reading
  // it in the initializer (even lazily) would make the server and client's
  // first render disagree (CookTodayForm.tsx's `step` state has the same
  // comment/fix). The mount effect below rehydrates it client-only.
  const [stepIndex, setStepIndex] = useState(initialStepIndex ?? 0);
  const [finished, setFinished] = useState(initialFinished);
  const [savedRecipeId, setSavedRecipeId] = useState<string | undefined>(initialSavedRecipeId);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Free-text "help FoodPadi cook this better for others" note — feeds
  // CookingInsightsService's cross-customer aggregate, never this cook's own
  // Memory. Entirely optional, sent alongside selectedTags on the same PATCH.
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const timerRef = useRef<CookingTimerHandle>(null);
  // The 30s pause between one step finishing and the next one's timer
  // starting — null while not in that pause. Timestamp-based like
  // CookingTimer's own countdown, for the same reason (accurate across a
  // throttled/backgrounded tab), and pausable/resumable on its own, same as
  // every per-step timer.
  const [transitionSecondsLeft, setTransitionSecondsLeft] = useState<number | null>(null);
  const [transitionRunning, setTransitionRunning] = useState(false);
  const transitionEndAtRef = useRef<number | null>(null);
  const transitionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards the auto-save below against firing twice — React Strict Mode
  // double-invokes effects in dev, and the `savedRecipeId` state guard alone
  // doesn't catch that (both invocations see the pre-update state), which
  // was creating two duplicate Recipe rows per cooking session.
  const autoSaveStarted = useRef(false);
  // Same double-invoke guard for the "mark cooked" call below.
  const markCookedStarted = useRef(false);

  // True once the rehydrate-from-sessionStorage effect below has run and its
  // state update has been applied — real state, not a ref, for the same
  // same-render-as-the-value reason CookTodayForm.tsx's `rehydrated` is.
  const [rehydrated, setRehydrated] = useState(false);

  // Client-only rehydrate of the step position — see the comment on the
  // initial `stepIndex` state above. A journey resume (initialStepIndex) is
  // authoritative and skips the sessionStorage copy entirely.
  useEffect(() => {
    if (initialStepIndex === undefined) {
      const persisted = loadPersistedStepIndex(recipe.steps.length);
      if (persisted > 0) setStepIndex(persisted);
    }
    setRehydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror step / completion / timer to the server for a resumable journey.
  // Fire-and-forget: journey tracking must never block or fail the cook.
  const patchJourney = (body: Record<string, unknown>) => {
    if (!journeyId) return;
    void fetch(`/api/proxy/cooking-journey/${journeyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  };
  const journeyTimer = (action: string, durationSeconds?: number) => {
    if (!journeyId) return;
    void fetch(`/api/proxy/cooking-journey/${journeyId}/timer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(durationSeconds ? { durationSeconds } : {}) }),
    }).catch(() => undefined);
  };

  // Keeps STEP_KEY in step with the current step — see loadPersistedStepIndex
  // above. Cleared once the session ends so a stale step never reappears in
  // a later, unrelated cook.
  useEffect(() => {
    if (!rehydrated) return;
    if (finished) {
      window.sessionStorage.removeItem(STEP_KEY);
    } else {
      window.sessionStorage.setItem(STEP_KEY, String(stepIndex));
    }
  }, [stepIndex, finished, rehydrated]);

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
    // With a journey, POST /cooking-journey/:id/complete already stamps
    // lastCookedAt server-side — don't double up. Without one, keep the
    // direct call exactly as before.
    if (!finished || isGuest || !savedRecipeId || markCookedStarted.current || journeyId) return;
    markCookedStarted.current = true;
    fetch(`/api/proxy/cook-today/recipes/${savedRecipeId}/cooked`, { method: 'POST' }).catch(() => undefined);
  }, [finished, isGuest, savedRecipeId, journeyId]);

  const totalSteps = recipe.steps.length;
  const isLastStep = stepIndex === totalSteps - 1;
  // Computed once per recipe, not per render/step — every step's timer needs
  // to agree on the same total (see computeStepDurations above).
  const stepDurations = useMemo(() => computeStepDurations(recipe), [recipe]);
  const stepDuration = stepDurations[stepIndex];

  const clearTransitionTicker = () => {
    if (transitionIntervalRef.current) {
      clearInterval(transitionIntervalRef.current);
      transitionIntervalRef.current = null;
    }
  };

  // Cancels the transition pause and actually moves to the next step —
  // called either when its countdown reaches zero or the cook skips it.
  const advanceStep = () => {
    clearTransitionTicker();
    transitionEndAtRef.current = null;
    setTransitionRunning(false);
    setTransitionSecondsLeft(null);
    setStepIndex((i) => {
      const next = i + 1;
      patchJourney({ currentStep: next });
      return next;
    });
  };

  const tickTransition = () => {
    if (transitionEndAtRef.current === null) return;
    const msLeft = transitionEndAtRef.current - Date.now();
    if (msLeft <= 0) {
      advanceStep();
      return;
    }
    setTransitionSecondsLeft(Math.ceil(msLeft / 1000));
  };

  const beginTransition = () => {
    clearTransitionTicker();
    setTransitionRunning(true);
    setTransitionSecondsLeft(STEP_TRANSITION_SECONDS);
    transitionEndAtRef.current = Date.now() + STEP_TRANSITION_SECONDS * 1000;
    transitionIntervalRef.current = setInterval(tickTransition, 1000);
  };

  // Same pause/resume shape as CookingTimer's own — the whole automated
  // process (step timers AND the gaps between them) can be paused and
  // picked back up without losing the remaining time either way.
  const pauseTransition = () => {
    if (transitionEndAtRef.current !== null) {
      const msLeft = Math.max(0, transitionEndAtRef.current - Date.now());
      setTransitionSecondsLeft(Math.ceil(msLeft / 1000));
    }
    clearTransitionTicker();
    transitionEndAtRef.current = null;
    setTransitionRunning(false);
  };

  const resumeTransition = () => {
    const startFrom = transitionSecondsLeft ?? STEP_TRANSITION_SECONDS;
    clearTransitionTicker();
    setTransitionRunning(true);
    transitionEndAtRef.current = Date.now() + startFrom * 1000;
    transitionIntervalRef.current = setInterval(tickTransition, 1000);
  };

  useEffect(() => {
    return () => clearTransitionTicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = () => {
    trackClientEvent('cook_today_step_completed', { stepIndex, totalSteps });
    if (isLastStep) {
      setFinished(true);
      if (journeyId) {
        void fetch(`/api/proxy/cooking-journey/${journeyId}/complete`, { method: 'POST' }).catch(() => undefined);
      }
    } else {
      // A 30s pause before the next step's own timer starts, rather than
      // snapping straight into it — see STEP_TRANSITION_SECONDS above.
      beginTransition();
    }
  };

  const goBack = () => {
    setStepIndex((i) => {
      const prev = Math.max(0, i - 1);
      if (prev !== i) patchJourney({ currentStep: prev });
      return prev;
    });
  };

  const handleTimerEvent = (
    kind: 'start' | 'pause' | 'resume' | 'complete',
    payload: { remainingSeconds: number; durationSeconds: number },
  ) => {
    journeyTimer(kind, kind === 'start' ? payload.durationSeconds : undefined);
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
        // The rating is in — the journey has done its job; move it out of
        // "active" so it stops showing as "Continue cooking".
        patchJourney({ status: 'completed', feedbackId: feedback.id });
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
    const trimmedComment = comment.trim();
    if (feedbackId && (selectedTags.length > 0 || trimmedComment)) {
      try {
        await fetch(`/api/proxy/feedback/${feedbackId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
            ...(trimmedComment ? { comment: trimmedComment } : {}),
          }),
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

              {/* Cross-customer learning signal (not this cook's own Memory) — see
                  CookingInsightsService. Shown regardless of star rating: even a
                  loved recipe can have a timing quirk worth flagging for others. */}
              <p className={styles.sectionHeading} style={{ marginTop: 'var(--space-lg)' }}>
                How was it to follow?
              </p>
              <div className={styles.chipWrap}>
                {[...COOKING_EXPERIENCE_TAGS.positive, ...COOKING_EXPERIENCE_TAGS.negative].map((tag) => (
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
              <label htmlFor="cook-feedback-comment" className={styles.sectionHeading} style={{ display: 'block', marginTop: 'var(--space-lg)' }}>
                Anything that would help FoodPadi cook this better for others?
              </label>
              <textarea
                id="cook-feedback-comment"
                className={styles.commentInput}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Optional — e.g. “the sauce step took longer than stated”"
              />

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

  if (transitionSecondsLeft !== null) {
    const nextIndex = stepIndex + 1;
    return (
      <div>
        <h1 className={styles.title}>Nice work!</h1>
        <p className={styles.subtitle}>{recipe.title}</p>

        <div className={styles.transitionCard}>
          <p className={styles.transitionEyebrow}>
            Up next — Step {nextIndex + 1} of {totalSteps}
          </p>
          <p className={styles.transitionCountdown}>{transitionSecondsLeft}s</p>
          <p className={styles.transitionNextStepText}>{recipe.steps[nextIndex]}</p>
          <div className={styles.timerControlRow}>
            {transitionRunning ? (
              <button type="button" className={styles.secondaryButton} onClick={pauseTransition}>
                Pause
              </button>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={resumeTransition}>
                Resume
              </button>
            )}
          </div>
        </div>

        <div className={styles.navRow}>
          <button type="button" className={styles.secondaryButton} onClick={advanceStep} style={{ flex: 1 }}>
            Start now
          </button>
        </div>
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

      <div className={styles.progressRow} aria-hidden="true">
        {recipe.steps.map((_, i) => (
          <span key={i} className={`${styles.progressDot} ${i <= stepIndex ? styles.progressDotDone : ''}`} />
        ))}
      </div>

      <p className={styles.stepGuideText}>{recipe.steps[stepIndex]}</p>

      <CookingTimer
        key={stepIndex}
        ref={timerRef}
        suggestedSeconds={stepDuration}
        onComplete={goNext}
        initialRemainingSeconds={
          initialStepIndex !== undefined && stepIndex === initialStepIndex
            ? initialTimerRemainingSeconds
            : undefined
        }
        onTimerEvent={handleTimerEvent}
      />

      <div className={styles.navRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={goBack}
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
          onBack={goBack}
          onFinish={() => setFinished(true)}
        />
      ) : null}
    </div>
  );
}
