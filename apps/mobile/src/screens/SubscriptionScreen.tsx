import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackLink } from '../components/BackLink';
import { Card } from '../components/Card';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Subscription'>;

/**
 * Subscription & payments — a real screen (not a Settings disclosure row)
 * so plan status and payment history each get proper room, matching how
 * Profile/Saved recipes/Saved plans are all their own screens rather than
 * expandable rows. Reached from Settings' "Subscription & payments" row.
 */
export function SubscriptionScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Settings" onPress={() => navigation.goBack()} />
      <Text style={s.title}>Subscription &amp; payments</Text>

      <Text style={s.sectionHeading}>Plan</Text>
      <Card style={s.section}>
        <View style={s.planRow}>
          <Text style={s.planLabel}>Current plan</Text>
          <View style={s.planBadge}>
            <Text style={s.planBadgeText}>Free</Text>
          </View>
        </View>
        <Text style={s.muted}>You&apos;re on the free plan. Paid plans aren&apos;t available yet.</Text>
      </Card>

      <Text style={s.sectionHeading}>Payment history</Text>
      <Card style={s.section}>
        <Text style={s.muted}>No payments yet.</Text>
      </Card>
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: spacing.xl, paddingTop: 56 },
    title: { ...typography.display, color: c.text, marginBottom: spacing.xl },
    sectionHeading: { ...typography.label, color: c.textMuted, marginBottom: spacing.sm, marginTop: spacing.lg },
    section: { marginBottom: spacing.sm },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    planLabel: { fontSize: 16, fontWeight: '600', color: c.text },
    planBadge: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 2,
    },
    planBadgeText: { fontSize: 12, fontWeight: '700', color: c.primary },
    muted: { ...typography.caption, color: c.textFaint, lineHeight: 18 },
  });
}
