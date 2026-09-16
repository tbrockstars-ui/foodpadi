import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  COOKING_EXPERIENCE_TAGS,
  FEEDBACK_TAG_LABELS,
  FEEDBACK_TAGS,
  type ClientEventMetadata,
  type ClientEventType,
  type RecipeView,
} from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { CookingAssistantPanel } from '../components/CookingAssistantPanel';
import { CookingTimer } from '../components/CookingTimer';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { FadeInView } from '../components/motion/FadeInView';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackScreenProps } from '../navigation/types';

type Props = AppStackScreenProps<'CookingSession'>;

// Best-effort duration hint from free-text step content (e.g. "cook for 5-7
// minutes") — RecipeView.steps has no structured timing, so this only ever
// pre-fills CookingTimer's preset; it's never treated as authoritative.
function guessSeconds(stepText: string): number | undefined {
  const match = stepText.match(/(\d+)\s*(?:-|to)?\s*\d*\s*(minute|min|second|sec)/i);
  if (!match) return undefined;
  const value = parseInt(match[1], 10);
  if (Number.isNaN(value)) return undefined;
  return match[2].toLowerCase().startsWith('sec') ? value : value * 60;
}

// Prefers the AI's own structured per-step duration (Cook Today only — see
// RecipeView.stepDurationsSeconds) over the text-guess above. `undefined`
// means "no timer for this step": either the structured array explicitly
// said so (null at this index), or there's no structured data and the text
// guess found nothing either — never fabricated either way. Web counterpart:
// apps/web/app/cook-today/CookingSession.tsx's same function.
function durationForStep(recipe: RecipeView, stepIndex: number): number | undefined {
  if (recipe.stepDurationsSeconds) {
    return recipe.stepDurationsSeconds[stepIndex] ?? undefined;
  }
  return guessSeconds(recipe.steps[stepIndex]);
}

// Every step should run its own timer and auto-advance — "Start Cooking"
// drives the whole recipe, not just the steps that happened to have an
// AI-provided or text-guessed duration. A step with a genuine per-step figure
// keeps it exactly; a step with neither gets this flat estimate instead.
// Web counterpart: apps/web/app/cook-today/CookingSession.tsx.
const DEFAULT_ESTIMATED_STEP_SECONDS = 90;

// Fixed pause between one step finishing (timer running out, or the cook
// marking it done early) and the next step's timer starting — a moment to
// actually move to the next bit before it counts down. Not applied after the
// last step (that's the "How did it go?" screen).
const STEP_TRANSITION_SECONDS = 30;

function computeStepDurations(recipe: RecipeView): number[] {
  return recipe.steps.map((_, i) => durationForStep(recipe, i) ?? DEFAULT_ESTIMATED_STEP_SECONDS);
}

const RATING_OPTIONS: { emoji: string; label: string; rating: number }[] = [
  { emoji: '❤️', label: 'Loved it', rating: 5 },
  { emoji: '🙂', label: 'Good', rating: 4 },
  { emoji: '😐', label: 'Okay', rating: 3 },
  { emoji: '👎', label: "Didn't like it", rating: 1 },
];

export function CookingSessionScreen({ navigation, route }: Props) {
  const { recipe, savedRecipeId: initialSavedRecipeId } = route.params;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const guestSession = useGuestSession();

  // Fire-and-forget client-only analytics — resolves whichever token this
  // session actually has (signed-in or guest) and never throws. Web
  // counterpart: apps/web/lib/trackClientEvent.ts.
  const trackEvent = async (eventType: ClientEventType, metadata?: ClientEventMetadata) => {
    try {
      const token = user ? await tokenStore.getAccessToken() : await guestSession.ensureSession();
      if (token) await api.trackEvent({ eventType, metadata }, token);
    } catch {
      // Best-effort only.
    }
  };

  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | undefined>(initialSavedRecipeId);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Free-text "help FoodPadi cook this better for others" note — feeds
  // CookingInsightsService's cross-customer aggregate, never this cook's own
  // Memory. Entirely optional, sent alongside selectedTags on the same PATCH.
  // Web counterpart: apps/web/app/cook-today/CookingSession.tsx's `comment`.
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  // The 30s pause between one step finishing and the next one's timer
  // starting — null while not in that pause. Timestamp-based like
  // CookingTimer's own countdown (accurate even if this 1s ticker is
  // throttled while the app is backgrounded), and pausable/resumable.
  const [transitionSecondsLeft, setTransitionSecondsLeft] = useState<number | null>(null);
  const [transitionRunning, setTransitionRunning] = useState(false);
  const transitionEndAtRef = useRef<number | null>(null);
  const transitionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards the auto-save below against firing twice — the `savedRecipeId`
  // state guard alone doesn't catch a same-tick double-invoke (React Strict
  // Mode in dev, or a fast remount), which would create two duplicate
  // Recipe rows per cooking session.
  const autoSaveStarted = useRef(false);
  // Same double-invoke guard for the "mark cooked" call below.
  const markCookedStarted = useRef(false);

  // Rating needs a real Recipe.id (FeedbackDto.entityId) — a freshly
  // generated recipe has none yet, so save it silently on entry for a
  // signed-in cook. Fire-and-forget, same precedent as sendCompanionAction:
  // a failed background save must never block the cooking session itself.
  useEffect(() => {
    if (!user || savedRecipeId || autoSaveStarted.current) return;
    autoSaveStarted.current = true;
    api
      .saveRecipe(recipe)
      .then((saved) => setSavedRecipeId(saved.id))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // "Recently cooked" engine, write side: the moment the cook reaches the
  // end of the steps, stamp Recipe.lastCookedAt — deliberately independent
  // of the optional rating below (see CookTodayService.markCooked).
  // Fire-and-forget, same precedent as the auto-save above.
  useEffect(() => {
    if (!finished || !user || !savedRecipeId || markCookedStarted.current) return;
    markCookedStarted.current = true;
    void api.markRecipeCooked(savedRecipeId).catch(() => undefined);
  }, [finished, user, savedRecipeId]);

  const totalSteps = recipe.steps.length;
  const isLastStep = stepIndex === totalSteps - 1;
  // Computed once per recipe, not per step — every step's timer agrees on the
  // same figure (see computeStepDurations above). Always a number now, so a
  // timer renders and auto-advances on EVERY step.
  const stepDurations = useMemo(() => computeStepDurations(recipe), [recipe]);
  const stepDuration = stepDurations[stepIndex];

  const clearTransitionTicker = () => {
    if (transitionIntervalRef.current) {
      clearInterval(transitionIntervalRef.current);
      transitionIntervalRef.current = null;
    }
  };

  // Cancels the transition pause and actually moves to the next step — either
  // when its countdown hits zero or the cook taps "Start now".
  const advanceStep = () => {
    clearTransitionTicker();
    transitionEndAtRef.current = null;
    setTransitionRunning(false);
    setTransitionSecondsLeft(null);
    setStepIndex((i) => i + 1);
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
  // sequence (step timers AND the gaps between them) can be paused and picked
  // back up without losing the remaining time.
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
    void trackEvent('cook_today_step_completed', { stepIndex, totalSteps });
    if (isLastStep) {
      setFinished(true);
    } else {
      // A 30s pause before the next step's own timer starts, rather than
      // snapping straight into it — see STEP_TRANSITION_SECONDS above.
      beginTransition();
    }
  };

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  // Lands the cook back on the tab bar's Home tab rather than wherever this
  // session happened to be pushed from (Cook Today, Saved Recipes,
  // Favorites, a Dealer profile, …) — and resets the stack so device/gesture
  // "back" can't return into a finished cooking session. "Landing page" per
  // the mobile decluttering pass (see navigation/types.ts) is the Home tab.
  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] });
  };

  const pickRating = async (rating: number) => {
    setSelectedRating(rating);
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }
    if (!savedRecipeId) return; // background save hasn't landed yet — rating silently unavailable
    setSubmittingRating(true);
    try {
      const feedback = await api.submitFeedback({
        entityType: 'RECIPE',
        entityId: savedRecipeId,
        context: 'COOK',
        rating,
      });
      setFeedbackId(feedback.id);
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
    if (!feedbackId || (selectedTags.length === 0 && !trimmedComment)) {
      goHome();
      return;
    }
    try {
      await api.updateFeedback(feedbackId, {
        ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
        ...(trimmedComment ? { comment: trimmedComment } : {}),
      });
    } catch {
      // Non-blocking — the rating itself already saved.
    } finally {
      goHome();
    }
  };

  if (finished) {
    return (
      <Screen scroll>
        <ScreenHeader
          title="How did it go?"
          subtitle={recipe.title}
          onBack={goHome}
          backLabel="Home"
        />

        <View style={styles.ratingRow}>
          {RATING_OPTIONS.map((option) => (
            <View key={option.rating} style={styles.ratingOption}>
              <Button
                label={`${option.emoji}`}
                variant={selectedRating === option.rating ? 'primary' : 'secondary'}
                onPress={() => pickRating(option.rating)}
                loading={submittingRating && selectedRating === option.rating}
                style={styles.ratingButton}
              />
              <Text style={styles.ratingLabel}>{option.label}</Text>
            </View>
          ))}
        </View>

        {selectedRating !== null && (user ? feedbackId : true) ? (
          <FadeInView>
            {user ? (
              <>
                {/* Free-text feedback — right under the rating icons, ahead of
                    the quick-tag chips, so it's the first thing a cook sees
                    after rating rather than buried below two rows of chips. */}
                <Text style={styles.sectionHeading}>Tell us about the cooking experience</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Optional — e.g. “the sauce step took longer than stated”"
                  placeholderTextColor={colors.textFaint}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />

                <Text style={styles.sectionHeading}>
                  {selectedRating >= 4 ? 'What made it good?' : 'What should we change next time?'}
                </Text>
                <View style={styles.tagWrap}>
                  {(selectedRating >= 4 ? FEEDBACK_TAGS.RECIPE.positive : FEEDBACK_TAGS.RECIPE.negative).map((tag) => (
                    <Chip
                      key={tag}
                      label={FEEDBACK_TAG_LABELS[tag] ?? tag}
                      selected={selectedTags.includes(tag)}
                      onPress={() => toggleTag(tag)}
                    />
                  ))}
                </View>

                {/* Cross-customer learning signal (not this cook's own Memory) —
                    see CookingInsightsService. Shown regardless of star rating. */}
                <Text style={styles.sectionHeading}>How was it to follow?</Text>
                <View style={styles.tagWrap}>
                  {[...COOKING_EXPERIENCE_TAGS.positive, ...COOKING_EXPERIENCE_TAGS.negative].map((tag) => (
                    <Chip
                      key={tag}
                      label={FEEDBACK_TAG_LABELS[tag] ?? tag}
                      selected={selectedTags.includes(tag)}
                      onPress={() => toggleTag(tag)}
                    />
                  ))}
                </View>

                <Button label="Done" onPress={saveTags} style={styles.actionSpacing} />
              </>
            ) : (
              <Button label="Back to Home" variant="tertiary" onPress={goHome} style={styles.actionSpacing} />
            )}
          </FadeInView>
        ) : null}

        <SignupPromptModal
          visible={showSignupPrompt}
          message="Create a free account and FoodPadi remembers this recipe — and what you thought of it — for next time."
          onCreateAccount={() => {
            setShowSignupPrompt(false);
            navigation.goBack();
          }}
          onDismiss={() => setShowSignupPrompt(false)}
        />
      </Screen>
    );
  }

  // Between-steps pause: the current step's timer has ended (or the cook
  // tapped "I'm Ready"), the next one hasn't started yet. Web counterpart:
  // CookingSession.tsx's `transitionSecondsLeft` branch.
  if (transitionSecondsLeft !== null) {
    const nextIndex = stepIndex + 1;
    return (
      <Screen scroll>
        <ScreenHeader title="Nice work!" subtitle={recipe.title} />

        <View style={styles.transitionCard}>
          <Text style={styles.transitionEyebrow}>
            Up next — Step {nextIndex + 1} of {totalSteps}
          </Text>
          <Text style={styles.transitionCountdown}>{transitionSecondsLeft}s</Text>
          <Text style={styles.transitionNextStepText}>{recipe.steps[nextIndex]}</Text>
          <Button
            label={transitionRunning ? 'Pause' : 'Resume'}
            variant="secondary"
            onPress={transitionRunning ? pauseTransition : resumeTransition}
            style={styles.transitionControl}
          />
        </View>

        <Button label="Start now" onPress={advanceStep} style={styles.actionSpacing} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title={`Step ${stepIndex + 1} of ${totalSteps}`}
        subtitle={recipe.title}
        onBack={() => navigation.goBack()}
        backLabel="Cancel"
      />

      <View style={styles.progressRow}>
        {recipe.steps.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= stepIndex && styles.progressDotDone]} />
        ))}
      </View>

      <FadeInView key={`step-${stepIndex}`}>
        <Text style={styles.stepText}>{recipe.steps[stepIndex]}</Text>
      </FadeInView>

      {/* Every step now has a timer — it auto-starts and, on reaching zero,
          calls goNext to run the whole recipe hands-free. */}
      <CookingTimer key={`timer-${stepIndex}`} suggestedSeconds={stepDuration} onComplete={goNext} />

      <View style={styles.navRow}>
        <Button label="Back" variant="secondary" onPress={goBack} disabled={stepIndex === 0} style={styles.navButton} />
        <Button
          label={isLastStep ? 'Finish Cooking' : "I'm Ready"}
          onPress={goNext}
          style={styles.navButton}
        />
      </View>

      {user ? <CookingAssistantPanel recipe={recipe} stepIndex={stepIndex} /> : null}
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    progressRow: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
    progressDot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surfaceSunken },
    progressDotDone: { backgroundColor: c.primary },
    stepText: { fontSize: 22, lineHeight: 30, color: c.text, fontWeight: '600', marginTop: spacing.md },
    navRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
    navButton: { flex: 1 },
    ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
    ratingOption: { alignItems: 'center', flex: 1 },
    ratingButton: { minWidth: 56, paddingHorizontal: spacing.md },
    ratingLabel: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs, textAlign: 'center' },
    sectionHeading: { ...typography.overline, color: c.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    commentInput: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: c.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    actionSpacing: { marginTop: spacing.xl },
    transitionCard: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    transitionEyebrow: { ...typography.overline, color: c.textMuted, marginBottom: spacing.sm },
    transitionCountdown: {
      fontSize: 40,
      fontWeight: '700',
      color: c.primary,
      fontVariant: ['tabular-nums'],
      marginBottom: spacing.md,
    },
    transitionNextStepText: {
      fontSize: 16,
      lineHeight: 24,
      color: c.text,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    transitionControl: { minWidth: 140 },
  });
}
