import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FEEDBACK_TAG_LABELS, FEEDBACK_TAGS } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { CookingAssistantPanel } from '../components/CookingAssistantPanel';
import { CookingTimer } from '../components/CookingTimer';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { FadeInView } from '../components/motion/FadeInView';
import { spacing, typography, type ThemeColors } from '../theme/colors';
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

  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | undefined>(initialSavedRecipeId);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
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

  const goNext = () => {
    if (isLastStep) {
      setFinished(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

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
    if (!feedbackId || selectedTags.length === 0) {
      navigation.goBack();
      return;
    }
    try {
      await api.updateFeedback(feedbackId, { tags: selectedTags });
    } catch {
      // Non-blocking — the rating itself already saved.
    } finally {
      navigation.goBack();
    }
  };

  if (finished) {
    return (
      <Screen scroll>
        <ScreenHeader title="How did it go?" subtitle={recipe.title} />

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
                <Button label="Done" onPress={saveTags} style={styles.actionSpacing} />
              </>
            ) : (
              <Button label="Done" variant="tertiary" onPress={() => navigation.goBack()} style={styles.actionSpacing} />
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

  return (
    <Screen scroll>
      <ScreenHeader
        title={`Step ${stepIndex + 1} of ${totalSteps}`}
        subtitle={recipe.title}
        onBack={() => navigation.goBack()}
        backLabel="Cancel"
      />

      <FadeInView key={stepIndex}>
        <Text style={styles.stepText}>{recipe.steps[stepIndex]}</Text>
      </FadeInView>

      <CookingTimer key={stepIndex} suggestedSeconds={guessSeconds(recipe.steps[stepIndex])} />

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
    stepText: { fontSize: 22, lineHeight: 30, color: c.text, fontWeight: '600', marginTop: spacing.md },
    navRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
    navButton: { flex: 1 },
    ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
    ratingOption: { alignItems: 'center', flex: 1 },
    ratingButton: { minWidth: 56, paddingHorizontal: spacing.md },
    ratingLabel: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs, textAlign: 'center' },
    sectionHeading: { ...typography.overline, color: c.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actionSpacing: { marginTop: spacing.xl },
  });
}
