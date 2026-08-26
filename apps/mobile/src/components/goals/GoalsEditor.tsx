import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FOOD_GOALS, FoodGoal, MAX_FOOD_GOALS } from '@foodpadi/shared';
import { api } from '../../api/client';
import { GOAL_LABELS } from '../../constants/goalLabels';
import { Button } from '../Button';
import { GoalCard } from '../GoalCard';
import { colors, spacing, typography } from '../../theme/colors';

const SELECTABLE_GOALS = FOOD_GOALS.filter((g) => g !== 'none');

interface Props {
  initialGoals?: FoodGoal[];
  initialPrimary?: FoodGoal | null;
  initialNote?: string;
  /** Called after a successful save. */
  onDone: () => void;
  /** Present only for onboarding — omit to show "Cancel" instead (edit flow). */
  onSkip?: () => void;
  onCancel?: () => void;
  continueLabel?: string;
}

/**
 * Owns the whole goal-selection flow: multi-select (max 3) -> optional
 * personal-goal note -> optional "which is primary" phase. Reused by both
 * onboarding's GoalScreen and the later Profile > Edit Goals screen so the
 * behaviour (and its edge cases) only needs to exist once.
 */
export function GoalsEditor({ initialGoals, initialPrimary, initialNote, onDone, onSkip, onCancel, continueLabel }: Props) {
  const [phase, setPhase] = useState<'select' | 'primary'>('select');
  const [selected, setSelected] = useState<FoodGoal[]>(initialGoals ?? []);
  const [primary, setPrimary] = useState<FoodGoal | null>(initialPrimary ?? null);
  const [personalNote, setPersonalNote] = useState(initialNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personalStarted = useRef(false);

  useEffect(() => {
    api.trackGoalEvent({ eventType: 'food_goal_screen_viewed' });
    return () => {
      if (limitTimer.current) clearTimeout(limitTimer.current);
    };
  }, []);

  const flashLimitMessage = () => {
    setLimitMessage(`You can choose up to ${MAX_FOOD_GOALS} goals.`);
    api.trackGoalEvent({ eventType: 'food_goal_limit_reached' });
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = setTimeout(() => setLimitMessage(null), 2500);
  };

  const toggle = (goal: FoodGoal) => {
    setError(null);

    if (goal === 'none') {
      if (selected.includes('none')) {
        setSelected([]);
        setPrimary(null);
      } else {
        setSelected(['none']);
        setPrimary('none');
        api.trackGoalEvent({ eventType: 'no_particular_goal_selected' });
      }
      return;
    }

    if (selected.includes(goal)) {
      const next = selected.filter((g) => g !== goal);
      setSelected(next);
      setPrimary((current) => {
        if (next.length === 1) return next[0];
        if (current && next.includes(current)) return current;
        return null;
      });
      api.trackGoalEvent({ eventType: 'food_goal_deselected', goalType: goal });
      return;
    }

    const withoutNone = selected.filter((g) => g !== 'none');
    if (withoutNone.length >= MAX_FOOD_GOALS) {
      flashLimitMessage();
      return;
    }

    const next = [...withoutNone, goal];
    setSelected(next);
    setPrimary(next.length === 1 ? next[0] : null);
    api.trackGoalEvent({ eventType: 'food_goal_selected', goalType: goal });
  };

  const onPersonalNoteFocus = () => {
    if (!personalStarted.current) {
      personalStarted.current = true;
      api.trackGoalEvent({ eventType: 'personal_goal_started' });
    }
  };

  const onPersonalNoteBlur = () => {
    if (personalNote.trim()) {
      api.trackGoalEvent({ eventType: 'personal_goal_completed' });
    }
  };

  const submit = async (primaryOverride?: FoodGoal) => {
    const primaryGoalType = primaryOverride ?? primary ?? selected[0];
    setSubmitting(true);
    setError(null);
    try {
      await api.setGoals({
        goalTypes: selected,
        primaryGoalType,
        personalGoalNote: selected.includes('personal') ? personalNote.trim() || undefined : undefined,
      });
      onDone();
    } catch {
      setError("Couldn't save your preferences. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    if (selected.length === 1) {
      submit(selected[0]);
      return;
    }
    if (primary && selected.includes(primary)) {
      submit(primary);
      return;
    }
    setPhase('primary');
  };

  const choosePrimary = (goal: FoodGoal) => {
    setPrimary(goal);
    api.trackGoalEvent({ eventType: 'primary_goal_selected', goalType: goal });
  };

  const skip = () => {
    api.trackGoalEvent({ eventType: 'food_goal_skipped' });
    onSkip?.();
  };

  if (phase === 'primary') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Which is your main priority?</Text>
        <Text style={styles.supporting}>FoodPadi will use this first when your goals compete.</Text>
        <ScrollView style={styles.options} keyboardShouldPersistTaps="handled">
          {selected.map((goal) => (
            <GoalCard
              key={goal}
              role="radio"
              label={GOAL_LABELS[goal]}
              selected={primary === goal}
              primary={primary === goal}
              disabled={submitting}
              onPress={() => choosePrimary(goal)}
            />
          ))}
        </ScrollView>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Try again" variant="secondary" onPress={() => submit()} />
          </View>
        ) : null}
        <View style={styles.buttonRow}>
          <Button label="Back" variant="secondary" onPress={() => setPhase('select')} disabled={submitting} style={{ flex: 1 }} />
          <Button
            label={continueLabel ?? 'Continue'}
            onPress={() => submit()}
            disabled={!primary}
            loading={submitting}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.heading}>What are your food & lifestyle goals?</Text>
      <Text style={styles.supporting}>Choose up to {MAX_FOOD_GOALS}. You can change these anytime.</Text>
      {selected.length > 0 ? (
        <Text style={styles.counter}>
          {selected.length} of {MAX_FOOD_GOALS} selected
        </Text>
      ) : null}
      {limitMessage ? <Text style={styles.limitMessage}>{limitMessage}</Text> : null}

      <ScrollView style={styles.options} keyboardShouldPersistTaps="handled">
        {SELECTABLE_GOALS.map((goal) => (
          <React.Fragment key={goal}>
            <GoalCard
              label={GOAL_LABELS[goal]}
              selected={selected.includes(goal)}
              disabled={submitting}
              onPress={() => toggle(goal)}
            />
            {goal === 'personal' && selected.includes('personal') ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Tell us about your goal</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g. Make weekday meals easier"
                  placeholderTextColor={colors.textFaint}
                  value={personalNote}
                  onChangeText={setPersonalNote}
                  onFocus={onPersonalNoteFocus}
                  onBlur={onPersonalNoteBlur}
                  maxLength={140}
                  multiline
                />
                <Text style={styles.noteHelper}>Keep it food or lifestyle related.</Text>
                <Text style={styles.noteCounter}>{personalNote.length}/140</Text>
              </View>
            ) : null}
          </React.Fragment>
        ))}
        <GoalCard
          label={GOAL_LABELS.none}
          selected={selected.includes('none')}
          disabled={submitting}
          onPress={() => toggle('none')}
        />
        {selected.includes('none') ? (
          <Text style={styles.noneHelper}>FoodPadi won't optimise your recommendations around a specific goal.</Text>
        ) : null}
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Try again" variant="secondary" onPress={() => handleContinue()} />
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Button
          label={continueLabel ?? 'Continue'}
          onPress={handleContinue}
          disabled={selected.length === 0}
          loading={submitting}
          style={{ flex: 1 }}
        />
        {onSkip ? (
          <Button label="Skip for now" variant="secondary" onPress={skip} disabled={submitting} style={{ flex: 1 }} />
        ) : onCancel ? (
          <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={submitting} style={{ flex: 1 }} />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  supporting: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  counter: { ...typography.caption, color: colors.textFaint, marginBottom: spacing.md },
  limitMessage: { ...typography.caption, color: colors.warning, marginBottom: spacing.sm },
  options: { flexGrow: 0, marginBottom: spacing.md },
  noteBox: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  noteLabel: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  noteInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
    minHeight: 44,
  },
  noteHelper: { ...typography.caption, color: colors.textFaint, marginTop: spacing.sm },
  noteCounter: { ...typography.caption, color: colors.textFaint, textAlign: 'right', marginTop: spacing.xs },
  noneHelper: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  errorText: { ...typography.caption, color: colors.danger },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
});
