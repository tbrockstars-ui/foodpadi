import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DISCLAIMER_TEXT, type PlanPreviewDay } from '@foodpadi/shared';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { BackLink } from '../components/BackLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { Tag } from '../components/Tag';
import { guestPrompts } from '../lib/guestPrompts';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = Pick<NativeStackScreenProps<AppStackParamList, 'PlanAhead'>, 'navigation'> & {
  onRequestLogin: () => void;
};

const SCOPES: { label: string; days: number }[] = [
  { label: 'Just tomorrow', days: 1 },
  { label: '3 days', days: 3 },
  { label: 'This week', days: 7 },
];

type Stage = 'idle' | 'disclaimer' | 'loading' | 'preview' | 'error';

/**
 * Guest / signed-out Plan Ahead (guest-mode brief §8). A real, non-AI
 * preview built from the curated recipe pool (GET /plan-ahead/preview) —
 * nothing is saved, there are no reminders and no per-day edits. Those need
 * a free account, and the card at the bottom says why.
 */
export function PlanAheadGuestPreview({ navigation, onRequestLogin }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const guestSession = useGuestSession();
  const needsGuestDisclaimer = !guestSession.disclaimerAcknowledged;

  const [days, setDays] = useState(3);
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<PlanPreviewDay[]>([]);
  const [acknowledging, setAcknowledging] = useState(false);

  const load = async (d: number) => {
    setStage('loading');
    try {
      const token = await guestSession.ensureSession();
      let res;
      try {
        res = await api.getPlanPreview(d, token);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          res = await api.getPlanPreview(d, await guestSession.recoverSession());
        } else {
          throw e;
        }
      }
      setPreview(res.days);
      setStage('preview');
      void guestPrompts.markSeen('plan_preview');
    } catch {
      setStage('error');
    }
  };

  const start = () => {
    if (needsGuestDisclaimer) {
      setStage('disclaimer');
      return;
    }
    void load(days);
  };

  const acknowledgeDisclaimer = async () => {
    setAcknowledging(true);
    try {
      await guestSession.acknowledgeDisclaimer();
      await load(days);
    } finally {
      setAcknowledging(false);
    }
  };

  const pickScope = (d: number) => {
    setDays(d);
    if (stage === 'preview') void load(d);
  };

  if (stage === 'loading') {
    return <LoadingState message="Putting together a sample plan…" />;
  }

  if (stage === 'disclaimer') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Before you start</Text>
        <ScrollView style={styles.disclaimerBox} contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
        <Button
          label="I understand"
          onPress={acknowledgeDisclaimer}
          loading={acknowledging}
          style={styles.actionSpacing}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Home" onPress={() => navigation.goBack()} />
      <Text style={styles.title}>Plan your next few meals</Text>
      <Text style={styles.subtitle}>
        A preview of how Plan Ahead works — no account needed to look around.
      </Text>

      <View style={styles.chipRow}>
        {SCOPES.map((s) => (
          <TouchableOpacity
            key={s.days}
            style={[styles.chip, days === s.days && styles.chipSelected]}
            onPress={() => pickScope(s.days)}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, days === s.days && styles.chipTextSelected]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {stage === 'idle' || stage === 'error' ? (
        <Button
          label={stage === 'error' ? 'Try again' : 'Show a sample plan'}
          onPress={start}
          style={styles.actionSpacing}
        />
      ) : null}
      {stage === 'error' ? (
        <Text style={styles.errorText}>Couldn&apos;t load a preview right now. Please try again.</Text>
      ) : null}

      {stage === 'preview' ? (
        <>
          {preview.map(({ dayIndex, recipe }) => (
            <Card key={dayIndex} style={styles.dayCard}>
              <Text style={styles.dayLabel}>Day {dayIndex + 1}</Text>
              <Text style={styles.dayTitle}>{recipe.title}</Text>
              <View style={styles.tagRow}>
                <Tag label={`${recipe.cookTimeMinutes} min`} />
                <Tag label={`${recipe.servings} servings`} />
                {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
              </View>
            </Card>
          ))}

          <MemberBenefitCard
            icon="🗓"
            title="Want FoodPadi to remember your plan?"
            body="This preview isn't saved. With a free account your plan sticks around and works for you."
            bullets={[
              'Save your meal plans',
              'Get a reminder before it’s time to cook',
              'Pick up your plan again tomorrow',
              'Keep your cuisines and the things you avoid',
              'Open it on another device',
            ]}
            ctaLabel="Create free account"
            onPress={onRequestLogin}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: spacing.xl, paddingTop: 56 },
    title: { ...typography.display, color: c.text, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: c.textMuted, marginBottom: spacing.lg },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
    },
    chipSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    chipText: { fontSize: 13, color: c.text },
    chipTextSelected: { color: c.primary, fontWeight: '600' },
    actionSpacing: { marginTop: spacing.xl },
    errorText: { color: c.danger, marginTop: spacing.md, fontSize: 14 },
    dayCard: { marginTop: spacing.md },
    dayLabel: { ...typography.label, color: c.textMuted, marginBottom: spacing.xs },
    dayTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.sm },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    disclaimerBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
    },
    disclaimerText: { fontSize: 14, lineHeight: 21, color: c.text },
  });
}
