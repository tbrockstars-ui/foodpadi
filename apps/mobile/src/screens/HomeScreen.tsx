import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { chipLabel, routeFoodDecision, SITUATION_CHIPS, SituationChip, whyLabel } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Tag } from '../components/Tag';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'> & { onRequestLogin: () => void };

// Secondary shortcuts for returning users who already know which tool they
// want — the unified chip flow above is the primary, first-time experience
// (docs/IMPLEMENTATION_PLAN.md's "What should I eat?" Home rework).
const TOOL_SHORTCUTS = [
  { key: 'eat-now', label: 'Eat Now', live: true },
  { key: 'cook-today', label: 'Cook Today', live: true },
  { key: 'plan-ahead', label: 'Plan Ahead', live: true },
  { key: 'scan', label: 'Scan', live: true },
] as const;

export function HomeScreen({ navigation, onRequestLogin }: Props) {
  const { user } = useAuth();
  const isGuest = !user;
  const [selected, setSelected] = useState<SituationChip[]>([]);

  const toggleChip = (chip: SituationChip) => {
    setSelected((current) =>
      current.includes(chip) ? current.filter((c) => c !== chip) : [...current, chip],
    );
  };

  const askFoodPadi = () => {
    const target = routeFoodDecision(selected);
    if (target.engine === 'cook-today') {
      navigation.navigate('CookToday');
    } else {
      navigation.navigate('EatNow', {
        initialQuery: target.query,
        initialMaxPricePence: target.maxPricePence,
        whyLabel: whyLabel(selected),
      });
    }
  };

  const openTool = (key: (typeof TOOL_SHORTCUTS)[number]['key']) => {
    if (key === 'eat-now') navigation.navigate('EatNow');
    if (key === 'cook-today') navigation.navigate('CookToday');
    // Plan Ahead is account-first (docs/FOODPADI_ONBOARDING_SPEC.md) — a
    // guest tapping it goes to signup, not a 401 screen.
    if (key === 'plan-ahead') {
      if (isGuest) onRequestLogin();
      else navigation.navigate('PlanAhead');
    }
    // Scan builds your personal pantry, which only exists for a real account
    // (same precedent as Plan Ahead) — a guest tapping it goes to signup.
    if (key === 'scan') {
      if (isGuest) onRequestLogin();
      else navigation.navigate('Scan');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>FoodPadi</Text>
        <Text
          style={styles.headerLink}
          onPress={() => (isGuest ? onRequestLogin() : navigation.navigate('Profile'))}
          accessibilityRole="button"
        >
          {isGuest ? 'Log in' : 'Profile'}
        </Text>
      </View>

      <Text style={styles.heading}>What should I eat?</Text>
      <Text style={styles.subtitle}>Tell FoodPadi what you need and we'll help you decide.</Text>

      <View style={styles.chipWrap}>
        {SITUATION_CHIPS.map((chip) => (
          <Chip
            key={chip}
            label={chipLabel(chip)}
            selected={selected.includes(chip)}
            onPress={() => toggleChip(chip)}
          />
        ))}
      </View>

      <Button
        label="Ask FoodPadi"
        onPress={askFoodPadi}
        disabled={selected.length === 0}
        style={styles.askButton}
      />

      <Text style={styles.toolsHeading}>Or choose a tool</Text>
      <View style={styles.toolsRow}>
        {TOOL_SHORTCUTS.map((tool, index) => (
          <React.Fragment key={tool.key}>
            {index > 0 ? <Text style={styles.toolsDivider}>·</Text> : null}
            <TouchableOpacity
              onPress={tool.live ? () => openTool(tool.key) : undefined}
              disabled={!tool.live}
              accessibilityRole="button"
            >
              <View style={styles.toolShortcut}>
                <Text style={[styles.toolLabel, !tool.live && styles.toolLabelDisabled]}>{tool.label}</Text>
                {!tool.live ? <Tag label="Soon" tone="neutral" /> : null}
              </View>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {isGuest ? (
        <Card>
          <Text style={styles.companionHeading}>Browsing as a guest</Text>
          <Text style={styles.companionBody}>
            Eat Now and Cook Today work without an account. Create one anytime you want to save a
            recipe, plan ahead, or get reminders.
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.companionHeading}>Your companion</Text>
          <Text style={styles.companionBody}>
            Nothing planned yet — try Plan Ahead to get started.
          </Text>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 64 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  brand: { ...typography.label, color: colors.textMuted, letterSpacing: 1 },
  headerLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  heading: { ...typography.display, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  askButton: { marginBottom: spacing.xl },
  toolsHeading: {
    ...typography.label,
    color: colors.textFaint,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  toolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  toolsDivider: { color: colors.textFaint },
  toolShortcut: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  toolLabel: { fontSize: 14, fontWeight: '600', color: colors.primary },
  toolLabelDisabled: { color: colors.textFaint },
  companionHeading: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  companionBody: { ...typography.body, color: colors.text },
});
