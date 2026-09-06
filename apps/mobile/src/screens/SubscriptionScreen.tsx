import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
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
    <Screen scroll>
      <ScreenHeader title="Subscription &amp; payments" onBack={() => navigation.goBack()} backLabel="Settings" />

      <Section title="Plan">
        <Card>
          <View style={s.planRow}>
            <Text style={s.planLabel}>Current plan</Text>
            <View style={s.planBadge}>
              <Text style={s.planBadgeText}>Free</Text>
            </View>
          </View>
          <Text style={s.muted}>You&apos;re on the free plan. Paid plans aren&apos;t available yet.</Text>
        </Card>
      </Section>

      <Section title="Payment history">
        <Card>
          <Text style={s.muted}>No payments yet.</Text>
        </Card>
      </Section>
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
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
