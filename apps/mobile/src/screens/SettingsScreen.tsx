import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { BackLink } from '../components/BackLink';
import { spacing, radius, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

/**
 * Settings — the mobile counterpart to apps/web/app/SettingsMenu.tsx. Tucks
 * the account links, the black (default) / white theme choice, and
 * read-only subscription / payment placeholders behind one screen reached
 * from the Home gear.
 */
export function SettingsScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const { scheme, colors, setScheme } = useTheme();
  const s = makeStyles(colors);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Home" onPress={() => navigation.goBack()} />
      <Text style={s.title}>Settings</Text>

      <Text style={s.sectionLabel}>Account</Text>
      <View style={s.group}>
        <Row label="Profile" onPress={() => navigation.navigate('Profile')} colors={colors} />
        <Row label="Saved recipes" onPress={() => navigation.navigate('SavedRecipes')} colors={colors} />
        <Row label="Saved plans" onPress={() => navigation.navigate('SavedPlans')} colors={colors} last />
      </View>

      <Text style={s.sectionLabel}>Appearance</Text>
      <View style={s.segmented}>
        <TouchableOpacity
          style={[s.segment, scheme === 'dark' && s.segmentActive]}
          onPress={() => setScheme('dark')}
          accessibilityRole="radio"
          accessibilityState={{ selected: scheme === 'dark' }}
        >
          <Text style={[s.segmentText, scheme === 'dark' && s.segmentTextActive]}>Black</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.segment, scheme === 'default' && s.segmentActive]}
          onPress={() => setScheme('default')}
          accessibilityRole="radio"
          accessibilityState={{ selected: scheme === 'default' }}
        >
          <Text style={[s.segmentText, scheme === 'default' && s.segmentTextActive]}>White</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>Subscription</Text>
      <View style={s.group}>
        <View style={[s.row, s.rowLast]}>
          <Text style={s.rowLabel}>Plan</Text>
          <View style={s.planBadge}>
            <Text style={s.planBadgeText}>Free</Text>
          </View>
        </View>
      </View>
      <Text style={s.muted}>You&apos;re on the free plan. Paid plans aren&apos;t available yet.</Text>

      <Text style={s.sectionLabel}>Payment history</Text>
      <Text style={s.muted}>No payments yet.</Text>

      <TouchableOpacity style={s.logout} onPress={logout} accessibilityRole="button">
        <Text style={s.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({
  label,
  onPress,
  colors,
  last,
}: {
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  last?: boolean;
}) {
  const s = makeStyles(colors);
  return (
    <TouchableOpacity style={[s.row, last && s.rowLast]} onPress={onPress} accessibilityRole="button">
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: spacing.xl, paddingTop: 56 },
    title: { ...typography.display, color: c.text, marginBottom: spacing.lg },
    sectionLabel: {
      ...typography.label,
      color: c.textFaint,
      textTransform: 'uppercase',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    group: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: c.text },
    chevron: { fontSize: 20, color: c.textFaint },
    segmented: {
      flexDirection: 'row',
      gap: spacing.xs,
      padding: spacing.xs,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
    },
    segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
    segmentActive: { backgroundColor: c.surface },
    segmentText: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    segmentTextActive: { color: c.text },
    planBadge: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 2,
    },
    planBadgeText: { fontSize: 12, fontWeight: '700', color: c.primary },
    muted: { ...typography.caption, color: c.textFaint, marginTop: spacing.xs, lineHeight: 18 },
    logout: {
      marginTop: spacing.xl,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    logoutText: { fontSize: 16, fontWeight: '600', color: c.danger },
  });
}
