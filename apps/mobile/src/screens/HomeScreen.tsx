import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/Card';
import { Tag } from '../components/Tag';
import { colors, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'> & { onRequestLogin: () => void };

const PRIMARY_ACTIONS = [
  { key: 'eat-now', label: 'Eat now', subtitle: 'Find something to eat', live: true },
  { key: 'cook-today', label: 'Cook today', subtitle: 'Choose something to cook', live: true },
  { key: 'plan-ahead', label: 'Plan ahead', subtitle: 'Plan your meals', live: true },
  { key: 'scan', label: 'Scan', subtitle: 'Food, ingredients or receipt', live: false },
] as const;

export function HomeScreen({ navigation, onRequestLogin }: Props) {
  const { user } = useAuth();
  const isGuest = !user;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>What do you need today?</Text>
        <Text
          style={styles.headerLink}
          onPress={() => (isGuest ? onRequestLogin() : navigation.navigate('Profile'))}
          accessibilityRole="button"
        >
          {isGuest ? 'Log in' : 'Profile'}
        </Text>
      </View>

      <View style={styles.grid}>
        {PRIMARY_ACTIONS.map((action) => (
          <Card
            key={action.key}
            style={[styles.actionCard, !action.live && styles.actionCardDisabled]}
            onPress={
              action.live
                ? () => {
                    if (action.key === 'eat-now') navigation.navigate('EatNow');
                    if (action.key === 'cook-today') navigation.navigate('CookToday');
                    // Plan Ahead is account-first (docs/FOODPADI_ONBOARDING_SPEC.md)
                    // — a guest tapping it goes to signup, not a 401 screen.
                    if (action.key === 'plan-ahead') {
                      if (isGuest) onRequestLogin();
                      else navigation.navigate('PlanAhead');
                    }
                  }
                : undefined
            }
          >
            <Text style={[styles.actionLabel, !action.live && styles.actionLabelDisabled]}>
              {action.label}
            </Text>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            {!action.live ? <Tag label="Soon" tone="neutral" /> : null}
          </Card>
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
    marginBottom: spacing.xl,
  },
  heading: { ...typography.display, color: colors.text, flex: 1, paddingRight: spacing.md },
  headerLink: { color: colors.primary, fontSize: 14, fontWeight: '600', paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  actionCard: { width: '47%' },
  actionCardDisabled: { opacity: 0.55 },
  actionLabel: { fontSize: 16, fontWeight: '700', color: colors.primary },
  actionLabelDisabled: { color: colors.text },
  actionSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md },
  companionHeading: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  companionBody: { ...typography.body, color: colors.text },
});
