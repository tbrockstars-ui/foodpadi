import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { colors, spacing } from '../theme/colors';

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
        {CUISINES.map((cuisine) => (
          <Chip key={cuisine} label={cuisine} selected={selected.includes(cuisine)} onPress={() => toggle(cuisine)} />
        ))}
      </View>
      <View style={styles.buttonRow}>
        <Button
          label={selected.length > 0 ? `Continue (${selected.length})` : 'Continue'}
          onPress={finish}
          loading={submitting}
          style={{ flex: 1 }}
        />
        <Button label="Skip for now" variant="secondary" onPress={skip} disabled={submitting} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 64 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flexGrow: 1, alignContent: 'flex-start' },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: 20 },
});
