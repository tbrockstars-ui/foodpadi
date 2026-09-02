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
import { MemberBenefitCard } from './MemberBenefitCard';
import { ShareNudge } from './ShareNudge';
import { AdSlot } from './AdSlot';
import { guestPrompts } from '../lib/guestPrompts';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

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
  { label: 'Vegan', text: 'Something vegan' },
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
interface DecideFlowProps {
  /** Guests only — routes the "let FoodPadi remember you" card's CTA to signup. */
  onRequestLogin?: () => void;
}

export function DecideFlow({ onRequestLogin }: DecideFlowProps = {}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const [budgetPounds, setBudgetPounds] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [options, setOptions] = useState<DecisionOptionView[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [getSearchStage, setGetSearchStage] = useState<LocalFoodSearchStage>('idle');
  // Guests only: shown under the options once they've decided a couple of
  // times — demonstrated intent before a prompt (guest-mode brief §12), then
  // never again this session (§13).
  const [showBenefit, setShowBenefit] = useState(false);

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
          budgetPence: budgetPounds ? Math.round(Number(budgetPounds) * 100) : undefined,
        },
        token,
      );
      if (reqId !== requestSeq.current) return; // superseded by a newer selection
      setOptions(data.options);
      setStage(data.options.length > 0 ? 'options' : 'no-options');
      if (!user && data.options.length > 0 && onRequestLogin) {
        const count = await guestPrompts.bumpCount('decide_options');
        const seen = await guestPrompts.hasSeen('decide_options');
        if (count >= 2 && !seen) {
          setShowBenefit(true);
          void guestPrompts.markSeen('decide_options');
        }
      }
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
    // any budget constraint typed for the previous selection shouldn't
    // silently carry over and narrow it. Matches web's DecideFlow.
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

  const hasSomethingToClear = description.trim().length > 0 || budgetPounds.trim().length > 0 || hasResultsShowing;

  // Resets the whole flow back to blank — the text field, budget, and any
  // results/error on screen — rather than just the input. Matches web's
  // DecideFlow.
  const clearAll = () => {
    setDescription('');
    setBudgetPounds('');
    clearResults();
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
        placeholder="Tell me what you want to eat"
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
        {hasSomethingToClear ? (
          <TouchableOpacity style={styles.clearButton} onPress={clearAll} accessibilityRole="button">
            <Text style={styles.clearButtonText}>✕ Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.constraintsRow}>
        <View style={styles.constraintField}>
          {budgetPounds ? <Text style={styles.constraintAffixPrefix}>£</Text> : null}
          <TextInput
            style={[styles.input, styles.constraintInput, budgetPounds ? styles.constraintInputHasPrefix : null]}
            placeholder="Budget £"
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

      {stage === 'error' ? (
        <View style={styles.stateBlock}>
          <Text style={styles.stateIcon}>😕</Text>
          <Text style={styles.stateMessage}>{errorMessage}</Text>
          <Button label="Try again" variant="secondary" onPress={() => decide()} style={styles.stateRetry} />
        </View>
      ) : null}
      {stage === 'no-options' ? (
        <View style={styles.stateBlock}>
          <Text style={styles.stateIcon}>🤔</Text>
          <Text style={styles.stateMessage}>
            FoodPadi couldn&apos;t put together a good option for that. Try describing it differently.
          </Text>
        </View>
      ) : null}

      {stage === 'options'
        ? options.map((option) => (
            <Card key={option.id} style={styles.optionCard}>
              <FoodImage
                image={option.image}
                alt={option.title}
                style={styles.optionImage}
                badge={option.foodIdea?.tags?.includes('vegan') ? 'Vegan' : undefined}
              />
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
                    {option.type === 'cook' ? 'Cook it' : 'Order now'}
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

      {stage === 'options' && showBenefit && onRequestLogin ? (
        <MemberBenefitCard
          icon="🧠"
          title="Want suggestions based on what you like?"
          body="Right now FoodPadi is just exploring ideas. Tell it your cuisines, your budget and what you avoid, and it decides around you."
          ctaLabel="Personalise FoodPadi"
          onPress={onRequestLogin}
        />
      ) : null}

      {stage === 'options' && !user ? <AdSlot placement="decide_results" /> : null}

      {/* Members: nudge to pass FoodPadi on right after it's proved useful
          (strategy §4/§5 — referral is a key acquisition channel). */}
      {stage === 'options' && user ? <ShareNudge context="decision" /> : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  disclaimerCard: { marginBottom: spacing.lg },
  disclaimerTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.md },
  disclaimerBox: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    backgroundColor: c.background,
    marginBottom: spacing.md,
  },
  disclaimerBoxContent: { padding: spacing.md },
  disclaimerText: { fontSize: 13, lineHeight: 20, color: c.text },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: c.text,
    marginBottom: spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  promptChip: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  promptChipSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  promptChipText: { fontSize: 13, color: c.text },
  promptChipTextSelected: { color: c.primary, fontWeight: '600' },
  // Resets the whole flow (text, budget, results) back to blank. Pushed to
  // the end of the chip row's line via marginLeft:auto, dashed/muted rather
  // than chip-styled so it doesn't read as one more suggestion to pick.
  clearButton: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  clearButtonText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  constraintsRow: { flexDirection: 'row', gap: spacing.sm },
  // Only the budget field lives here now (Minutes was removed) — a fixed
  // width rather than flex:1, so it sits left-aligned at roughly its old
  // size instead of stretching across the whole row.
  constraintField: { width: 160, justifyContent: 'center' },
  constraintInput: { flex: 1 },
  constraintInputHasPrefix: { paddingLeft: 22 },
  constraintAffixPrefix: {
    position: 'absolute',
    left: spacing.lg,
    fontSize: 15,
    color: c.textMuted,
  },
  decideButton: { marginTop: spacing.xs, marginBottom: spacing.lg },
  stateBlock: { alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  stateIcon: { fontSize: 32, lineHeight: 36, marginBottom: spacing.sm },
  stateMessage: { ...typography.body, color: c.textMuted, textAlign: 'center', marginBottom: spacing.md },
  stateRetry: { alignSelf: 'center', minWidth: 140, paddingVertical: spacing.sm },
  optionCard: { marginBottom: spacing.md },
  optionImage: { marginBottom: spacing.md },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  optionHeaderText: { flex: 1 },
  optionTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
  optionReason: { ...typography.body, color: c.textMuted },
  optionTypeBadge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  optionTypeCook: { backgroundColor: c.primarySoft },
  optionTypeGet: { backgroundColor: c.accentSoft },
  optionTypeBadgeText: { fontSize: 12, fontWeight: '700' },
  optionTypeCookText: { color: c.primary },
  optionTypeGetText: { color: c.accent },
  optionAction: { marginTop: spacing.md },
  optionActionText: { color: c.primary, fontSize: 14, fontWeight: '600' },
  optionDetail: { marginTop: spacing.md },
  ingredientLine: { ...typography.body, color: c.text, marginBottom: spacing.xs },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  stepNumber: { fontSize: 13, fontWeight: '700', color: c.primary, width: 18 },
  stepText: { ...typography.body, color: c.text, flex: 1 },
  });
}
