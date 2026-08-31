import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/Card';
import { DecideFlow } from '../components/DecideFlow';
import { Tag } from '../components/Tag';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'> & { onRequestLogin: () => void };

// Secondary shortcuts for returning users who already know which tool they
// want — DecideFlow above is the primary, first-time experience
// (docs/IMPLEMENTATION_PLAN.md's "What should I eat?" Home rework, and the
// decision-engine architecture memory's "single intent-first entry point").
const TOOL_SHORTCUTS = [
  { key: 'eat-now', label: 'Eat Now', live: true },
  { key: 'cook-today', label: 'Cook Today', live: true },
  { key: 'plan-ahead', label: 'Plan Ahead', live: true },
  { key: 'scan', label: 'Scan', live: true },
] as const;

export function HomeScreen({ navigation, onRequestLogin }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const isGuest = !user;

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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.brand}>FoodPadi</Text>
        <Text
          style={styles.headerLink}
          onPress={() => (isGuest ? onRequestLogin() : navigation.navigate('Settings'))}
          accessibilityRole="button"
          accessibilityLabel={isGuest ? 'Log in' : 'Settings'}
        >
          {isGuest ? 'Log in' : '⚙  Settings'}
        </Text>
      </View>

      <Text style={styles.heading}>What should I eat?</Text>
      <Text style={styles.subtitle}>Tell FoodPadi what you have or what you're after, and we'll decide.</Text>

      <View style={styles.decideWrap}>
        <DecideFlow />
      </View>

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
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { padding: spacing.xl, paddingTop: 64, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  brand: { ...typography.label, color: c.textMuted, letterSpacing: 1 },
  headerLink: { color: c.primary, fontSize: 14, fontWeight: '600' },
  heading: { ...typography.display, color: c.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: c.textMuted, marginBottom: spacing.lg },
  decideWrap: { marginBottom: spacing.lg },
  toolsHeading: {
    ...typography.label,
    color: c.textFaint,
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
  toolsDivider: { color: c.textFaint },
  toolShortcut: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  toolLabel: { fontSize: 14, fontWeight: '600', color: c.primary },
  toolLabelDisabled: { color: c.textFaint },
  companionHeading: { ...typography.label, color: c.textMuted, marginBottom: spacing.sm },
  companionBody: { ...typography.body, color: c.text },
  });
}
