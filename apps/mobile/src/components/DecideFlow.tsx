import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DISCLAIMER_TEXT, type DecideResponse, type DecisionOptionView } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { Button } from './Button';
import { Card } from './Card';
import { FoodImage } from './FoodImage';
import { LocalFoodSearch, type LocalFoodSearchStage } from './LocalFoodSearch';
import { colors, radius, spacing, typography } from '../theme/colors';

type Stage = 'idle' | 'deciding' | 'options' | 'no-options' | 'error';

// Quick-start prompts (brief section 8) — each just fills the same
// description field the user could type into by hand, so nothing about the
// underlying /decide call changes; they're a faster on-ramp, not a
// different flow. Web counterpart: apps/web/app/DecideFlow.tsx.
const PROMPT_CHIPS = [
  { label: "I'm hungry", text: "I'm hungry, surprise me" },
  { label: 'Something quick', text: 'Something quick to make' },
  { label: 'Something cheap', text: 'Something cheap and filling' },
  { label: 'Something comforting', text: 'Something comforting' },
  { label: 'Try something new', text: 'Something different from usual' },
];

/**
 * "FoodPadi decides" — the Understand Context -> Decide layer of the
 * intent-first decision engine, sitting above the direct Eat Now / Cook
 * Today / Plan Ahead shortcuts (see the decision-engine architecture
 * memory). Blends real Cook Today + Eat Now results into a small set of
 * explained options via POST /decide, rather than making the user pick a
 * mode first. Web counterpart: apps/web/app/DecideFlow.tsx.
 */
export function DecideFlow() {
  const { user } = useAuth();
  const guestSession = useGuestSession();
  // Same precedent as EatNowScreen: guests get a lazy, inline disclaimer
  // gate the first time they touch a feature that needs it, rather than the
  // whole app being blocked upfront — this is the entry point most guests
  // hit first, so it needs the same gate EatNowScreen already has.
  const [disclaimerShown, setDisclaimerShown] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const needsGuestDisclaimer = !user && !guestSession.disclaimerAcknowledged;

  const getToken = async () => (user ? ((await tokenStore.getAccessToken()) ?? '') : guestSession.ensureSession());

  const [description, setDescription] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('');
  const [budgetPounds, setBudgetPounds] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [options, setOptions] = useState<DecisionOptionView[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [getSearchStage, setGetSearchStage] = useState<LocalFoodSearchStage>('idle');

  // Bumped on every decide() call; a response whose id no longer matches is
  // stale (the user changed their selection mid-request) and is discarded so
  // an earlier call can't overwrite the results of a later one.
  const requestSeq = useRef(0);

  const getSearchBusy = getSearchStage === 'asking-permission' || getSearchStage === 'searching';

  const hasResultsShowing =
    stage === 'options' || stage === 'no-options' || stage === 'error' || stage === 'deciding';

  const clearResults = () => {
    requestSeq.current += 1; // abandon any in-flight decide response
    setStage('idle');
    setOptions([]);
    setExpandedId(null);
    setErrorMessage(null);
    setGetSearchStage('idle');
  };

  const decide = async (overrideDescription?: string) => {
    const trimmed = (overrideDescription ?? description).trim();
    if (trimmed.length < 3) return;

    if (needsGuestDisclaimer) {
      setDisclaimerShown(true);
      return;
    }

    const reqId = (requestSeq.current += 1);
    setStage('deciding');
    setErrorMessage(null);
    setExpandedId(null);
    setOptions([]); // clear the previous selection's results immediately
    setGetSearchStage('idle');
    try {
      const token = await getToken();
      const data: DecideResponse = await api.decide(
        {
          description: trimmed,
          timeMinutes: timeMinutes ? Number(timeMinutes) : undefined,
          budgetPence: budgetPounds ? Math.round(Number(budgetPounds) * 100) : undefined,
        },
        token,
      );
      if (reqId !== requestSeq.current) return; // superseded by a newer selection
      setOptions(data.options);
      setStage(data.options.length > 0 ? 'options' : 'no-options');
    } catch (e) {
      if (reqId !== requestSeq.current) return;
      setErrorMessage(
        e instanceof ApiError && e.message ? e.message : "FoodPadi couldn't decide right now. Please try again.",
      );
      setStage('error');
    }
  };

  const acknowledgeDisclaimer = async () => {
    setAcknowledging(true);
    try {
      await guestSession.acknowledgeDisclaimer();
      setDisclaimerShown(false);
      await decide();
    } finally {
      setAcknowledging(false);
    }
  };

  const pickChip = (text: string) => {
    if (text === description) return;
    setDescription(text);
    // A chip is a fresh, self-contained prompt ("I'm hungry, surprise me") —
    // any time/budget constraint typed for the previous selection shouldn't
    // silently carry over and narrow it. Matches web's DecideFlow.
    setTimeMinutes('');
    setBudgetPounds('');
    // Picking a chip clears any results already on screen and re-enables
    // "Decide for me" rather than auto-firing a new decide() — the user
    // asked for a chance to add constraints (time/budget) or just review
    // the new selection before running it, not an immediate re-run.
    clearResults();
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (hasResultsShowing) clearResults();
  };
  const handleConstraintChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    if (hasResultsShowing) clearResults();
  };

  if (disclaimerShown && needsGuestDisclaimer) {
    return (
      <Card style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>Before you start</Text>
        <ScrollView style={styles.disclaimerBox} contentContainerStyle={styles.disclaimerBoxContent}>
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
        <Button label="I understand" onPress={acknowledgeDisclaimer} loading={acknowledging} style={styles.decideButton} />
      </Card>
    );
  }

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="What do you have, or what are you after? e.g. chicken and rice"
        placeholderTextColor={colors.textFaint}
        value={description}
        onChangeText={handleDescriptionChange}
        onSubmitEditing={() => decide()}
        returnKeyType="go"
        autoComplete="off"
        autoCorrect={false}
      />

      <View style={styles.chipRow}>
        {PROMPT_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.label}
            style={[styles.promptChip, description === chip.text && styles.promptChipSelected]}
            onPress={() => pickChip(chip.text)}
            accessibilityRole="button"
          >
            <Text style={[styles.promptChipText, description === chip.text && styles.promptChipTextSelected]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.constraintsRow}>
        <View style={styles.constraintField}>
          <TextInput
            style={[styles.input, styles.constraintInput, timeMinutes ? styles.constraintInputHasSuffix : null]}
            placeholder="Minutes (optional)"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            value={timeMinutes}
            onChangeText={(v) => handleConstraintChange(setTimeMinutes, v)}
          />
          {timeMinutes ? <Text style={styles.constraintAffixSuffix}>mins</Text> : null}
        </View>
        <View style={styles.constraintField}>
          {budgetPounds ? <Text style={styles.constraintAffixPrefix}>£</Text> : null}
          <TextInput
            style={[styles.input, styles.constraintInput, budgetPounds ? styles.constraintInputHasPrefix : null]}
            placeholder="Budget £ (optional)"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            value={budgetPounds}
            onChangeText={(v) => handleConstraintChange(setBudgetPounds, v)}
          />
        </View>
      </View>

      <Button
        label={stage === 'deciding' ? 'Deciding…' : '✨ Decide for me'}
        onPress={() => decide()}
        disabled={description.trim().length < 3 || stage === 'deciding'}
        loading={stage === 'deciding'}
        style={styles.decideButton}
      />

      {stage === 'error' ? <Text style={styles.optionReason}>{errorMessage}</Text> : null}
      {stage === 'no-options' ? (
        <Text style={styles.optionReason}>
          FoodPadi couldn&apos;t put together a good option for that. Try describing it differently.
        </Text>
      ) : null}

      {stage === 'options'
        ? options.map((option) => (
            <Card key={option.id} style={styles.optionCard}>
              <FoodImage image={option.image} alt={option.title} style={styles.optionImage} />
              <View style={styles.optionHeader}>
                <View style={styles.optionHeaderText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionReason}>{option.reason}</Text>
                </View>
                <View style={[styles.optionTypeBadge, option.type === 'cook' ? styles.optionTypeCook : styles.optionTypeGet]}>
                  <Text
                    style={[
                      styles.optionTypeBadgeText,
                      option.type === 'cook' ? styles.optionTypeCookText : styles.optionTypeGetText,
                    ]}
                  >
                    {option.type === 'cook' ? 'Cook it' : 'Get it'}
                  </Text>
                </View>
              </View>

              {expandedId === option.id && option.type === 'get' && getSearchBusy ? null : (
                <TouchableOpacity
                  style={styles.optionAction}
                  onPress={() => {
                    setGetSearchStage('idle');
                    setExpandedId(expandedId === option.id ? null : option.id);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionActionText}>
                    {expandedId === option.id ? 'Hide' : option.type === 'cook' ? 'Show recipe' : 'Find it nearby'}
                  </Text>
                </TouchableOpacity>
              )}

              {expandedId === option.id && option.type === 'cook' && option.recipe ? (
                <View style={styles.optionDetail}>
                  {option.recipe.ingredients.map((ing, i) => (
                    <Text key={i} style={styles.ingredientLine}>
                      {ing.quantity ? `${ing.quantity} ` : ''}
                      {ing.unit ? `${ing.unit} ` : ''}
                      {ing.name}
                    </Text>
                  ))}
                  {option.recipe.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={styles.stepNumber}>{i + 1}</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {expandedId === option.id && option.type === 'get' ? (
                <View style={styles.optionDetail}>
                  <LocalFoodSearch query={option.title} getToken={getToken} autoStart onStageChange={setGetSearchStage} />
                </View>
              ) : null}
            </Card>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimerCard: { marginBottom: spacing.lg },
  disclaimerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  disclaimerBox: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  disclaimerBoxContent: { padding: spacing.md },
  disclaimerText: { fontSize: 13, lineHeight: 20, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  promptChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  promptChipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  promptChipText: { fontSize: 13, color: colors.text },
  promptChipTextSelected: { color: colors.primary, fontWeight: '600' },
  constraintsRow: { flexDirection: 'row', gap: spacing.sm },
  constraintField: { flex: 1, justifyContent: 'center' },
  constraintInput: { flex: 1 },
  constraintInputHasPrefix: { paddingLeft: 22 },
  constraintInputHasSuffix: { paddingRight: 44 },
  constraintAffixPrefix: {
    position: 'absolute',
    left: spacing.lg,
    fontSize: 15,
    color: colors.textMuted,
  },
  constraintAffixSuffix: {
    position: 'absolute',
    right: spacing.lg,
    fontSize: 15,
    color: colors.textMuted,
  },
  decideButton: { marginTop: spacing.xs, marginBottom: spacing.lg },
  optionCard: { marginBottom: spacing.md },
  optionImage: { marginBottom: spacing.md },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  optionHeaderText: { flex: 1 },
  optionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  optionReason: { ...typography.body, color: colors.textMuted },
  optionTypeBadge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  optionTypeCook: { backgroundColor: colors.primarySoft },
  optionTypeGet: { backgroundColor: colors.accentSoft },
  optionTypeBadgeText: { fontSize: 12, fontWeight: '700' },
  optionTypeCookText: { color: colors.primary },
  optionTypeGetText: { color: colors.accent },
  optionAction: { marginTop: spacing.md },
  optionActionText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  optionDetail: { marginTop: spacing.md },
  ingredientLine: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  stepNumber: { fontSize: 13, fontWeight: '700', color: colors.primary, width: 18 },
  stepText: { ...typography.body, color: colors.text, flex: 1 },
});
