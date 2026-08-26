import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, shadow, spacing, typography } from '../theme/colors';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'> & { onRequestLogin: () => void };

const PRIMARY_ACTIONS = [
  { key: 'eat-now', label: 'Eat now', subtitle: 'Find something to eat', live: false },
  { key: 'cook-today', label: 'Cook today', subtitle: 'Choose something to cook', live: true },
  { key: 'plan-ahead', label: 'Plan ahead', subtitle: 'Plan your meals', live: false },
  { key: 'scan', label: 'Scan', subtitle: 'Food, ingredients or receipt', live: false },
] as const;

export function HomeScreen({ navigation, onRequestLogin }: Props) {
  const { user, logout } = useAuth();
  const isGuest = !user;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>What do you need today?</Text>
        {isGuest ? (
          <TouchableOpacity onPress={onRequestLogin} accessibilityRole="button">
            <Text style={styles.headerLink}>Log in</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={logout} accessibilityRole="button">
            <Text style={styles.headerLink}>Log out</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.grid}>
        {PRIMARY_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.actionCard, !action.live && styles.actionCardDisabled]}
            disabled={!action.live}
            onPress={() => {
              if (action.key === 'cook-today') navigation.navigate('CookToday');
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.actionLabel, !action.live && styles.actionLabelDisabled]}>
              {action.label}
            </Text>
            <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            {!action.live ? (
              <View style={styles.comingSoonTag}>
                <Text style={styles.comingSoonText}>Soon</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {isGuest ? (
        <View style={styles.companionCard}>
          <Text style={styles.companionHeading}>Browsing as a guest</Text>
          <Text style={styles.companionBody}>
            Eat Now and Cook Today work without an account. Create one anytime you want to save a
            recipe, plan ahead, or get reminders.
          </Text>
        </View>
      ) : (
        <View style={styles.companionCard}>
          <Text style={styles.companionHeading}>Your companion</Text>
          <Text style={styles.companionBody}>
            Nothing planned yet — Eat Now and Plan Ahead arrive in the next build phase.
          </Text>
        </View>
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
  actionCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  actionCardDisabled: { opacity: 0.55 },
  actionLabel: { fontSize: 16, fontWeight: '700', color: colors.primary },
  actionLabelDisabled: { color: colors.text },
  actionSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  comingSoonTag: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  comingSoonText: { ...typography.label, color: colors.textFaint },
  companionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  companionHeading: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  companionBody: { ...typography.body, color: colors.text },
});
