import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import { colors } from '../theme/colors';

// A starting set of cuisines, not an exhaustive list — this is deliberately
// small and skippable (docs/FOODPADI_ONBOARDING_SPEC.md, docs/
// FOODPADI_LOGIN_ONBOARDING_RESEARCH.md §17): favourite cuisines are the one
// "optional at account creation" preference field, everything else (avoided
// ingredients, cooking time, budget) is collected progressively during real
// use, not here.
const CUISINES = [
  'Italian',
  'Chinese',
  'Indian',
  'Nigerian & West African',
  'Mexican',
  'Japanese',
  'Thai',
  'Mediterranean',
  'British & comfort food',
  'French',
  'Caribbean',
  'Middle Eastern',
] as const;

export function PreferencesScreen({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (cuisine: string) => {
    setSelected((current) =>
      current.includes(cuisine) ? current.filter((c) => c !== cuisine) : [...current, cuisine],
    );
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      await Promise.all(selected.map((cuisine) => api.addPreference({ cuisine })));
      await api.completeOnboarding();
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  const skip = async () => {
    setSubmitting(true);
    try {
      await api.completeOnboarding();
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Any cuisines you love?</Text>
      <Text style={styles.subtitle}>
        Pick as many as you like — FoodPadi will learn more about your taste as you go.
      </Text>
      <View style={styles.chipWrap}>
        {CUISINES.map((cuisine) => {
          const isSelected = selected.includes(cuisine);
          return (
            <TouchableOpacity
              key={cuisine}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggle(cuisine)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{cuisine}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={finish}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {selected.length > 0 ? `Continue (${selected.length})` : 'Continue'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={skip}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.buttonSecondaryText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 64 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flexGrow: 1, alignContent: 'flex-start' },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: '#EAF3EE' },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  button: { flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.primaryText, fontSize: 17, fontWeight: '600' },
  buttonSecondaryText: { color: colors.textMuted, fontSize: 17, fontWeight: '600' },
});
