import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FOOD_GOALS, FoodGoal } from '@foodpadi/shared';
import { api } from '../api/client';
import { colors } from '../theme/colors';

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

export function GoalScreen({ onSelected }: { onSelected: () => void }) {
  const [selected, setSelected] = useState<FoodGoal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.setGoal(selected);
      await api.completeOnboarding();
      onSelected();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>What is your food & lifestyle goal?</Text>
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
      <TouchableOpacity
        style={[styles.button, !selected && styles.buttonDisabled]}
        onPress={confirm}
        disabled={!selected || submitting}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
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
  optionSelected: { borderColor: colors.primary, backgroundColor: '#EAF3EE' },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
});
