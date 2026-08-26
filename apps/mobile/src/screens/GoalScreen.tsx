import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FOOD_GOALS, FoodGoal } from '@foodpadi/shared';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { colors, spacing } from '../theme/colors';

// Labels for the non-medical goal set (spec §10 / Decision 13). Never add a
// body-shape or weight-loss framed option to this list.
const GOAL_LABELS: Record<FoodGoal, string> = {
  balanced_meals: 'Eat more balanced meals',
  support_fitness: 'Support my fitness',
  maintain_weight: 'Maintain my current weight',
  reduce_spending: 'Reduce food spending',
  reduce_waste: 'Reduce food waste',
  home_cooked: 'Eat more home-cooked meals',
  explore_cuisines: 'Explore new foods',
  personal: 'Personal goal',
  none: 'No particular goal',
};

export function GoalScreen({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<FoodGoal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Goal is optional (docs/FOODPADI_ONBOARDING_SPEC.md) — this screen no
  // longer completes onboarding itself; Preferences (the next, also-skippable
  // step) does that once the short sequence is done.
  const confirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.setGoal(selected);
      onNext();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>What is your food & lifestyle goal?</Text>
      {/* A vertical list of full-width rows, not chips — with 9 fairly long
          textual options this reads more clearly than a wrapped pill grid;
          see docs/FOODPADI_DESIGN_SYSTEM.md §7 for why this stays distinct
          from the Chip component used elsewhere. */}
      <View style={styles.options}>
        {FOOD_GOALS.map((goal) => (
          <TouchableOpacity
            key={goal}
            style={[styles.option, selected === goal && styles.optionSelected]}
            onPress={() => setSelected(goal)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === goal }}
          >
            <Text style={[styles.optionText, selected === goal && styles.optionTextSelected]}>
              {GOAL_LABELS[goal]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.buttonRow}>
        <Button label="Continue" onPress={confirm} disabled={!selected} loading={submitting} style={{ flex: 1 }} />
        <Button label="Skip for now" variant="secondary" onPress={onNext} disabled={submitting} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 64 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 20 },
  options: { flexGrow: 1 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
});
