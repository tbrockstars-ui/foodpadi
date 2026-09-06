import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DISCLAIMER_TEXT, type PlanPreviewDay } from '@foodpadi/shared';
import { useGuestSession } from '../auth/GuestSessionContext';
import { api, ApiError } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tag } from '../components/Tag';
import { FadeInView } from '../components/motion/FadeInView';
import { getCuisineImage } from '../constants/cuisineImages';
import { guestPrompts } from '../lib/guestPrompts';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { MainTabScreenProps } from '../navigation/types';

type Props = Pick<MainTabScreenProps<'Plan'>, 'navigation'> & {
  onRequestLogin: () => void;
};

// A guest can only preview tomorrow — planning further ahead is the value a
// free account unlocks, so the longer scopes are shown but locked, and
// tapping one asks the guest to register rather than doing nothing.
const SCOPES: { label: string; days: number; guestAllowed: boolean }[] = [
  { label: 'Just tomorrow', days: 1, guestAllowed: true },
  { label: '3 days', days: 3, guestAllowed: false },
  { label: 'This week', days: 7, guestAllowed: false },
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

  const [days, setDays] = useState(1);
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<PlanPreviewDay[]>([]);
  const [acknowledging, setAcknowledging] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  // Set when a guest taps a locked scope (3 days / This week) — shows the
  // "register for more days" nudge under the chip row.
  const [showLockedNudge, setShowLockedNudge] = useState(false);

  // `explicitToken` — the freshly-rotated token returned by
  // acknowledgeDisclaimer(). It MUST be used directly: calling ensureSession()
  // again here would read a closure captured before that update and hand back
  // the stale, still-unacknowledged token (see GuestSessionContext's note),
  // which is exactly what made the preview 403 → "plan not coming out".
  const load = async (d: number, explicitToken?: string) => {
    setStage('loading');
    setErrorText(null);
    try {
      let res;
      try {
        res = await api.getPlanPreview(d, explicitToken ?? (await guestSession.ensureSession()));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // Guest token expired or the API rotated its secret — mint a fresh,
          // re-acknowledged one and retry.
          res = await api.getPlanPreview(d, await guestSession.recoverSession());
        } else if (e instanceof ApiError && e.status === 403) {
          // The token isn't disclaimer-acknowledged yet (e.g. freshly minted
          // after the cached one lapsed) — acknowledge and retry once.
          res = await api.getPlanPreview(d, await guestSession.acknowledgeDisclaimer());
        } else {
          throw e;
        }
      }
      setPreview(res.days);
      setStage('preview');
      void guestPrompts.markSeen('plan_preview');
    } catch (e) {
      setErrorText(
        e instanceof ApiError && e.message
          ? e.message
          : "Couldn't load a preview right now. Please try again.",
      );
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
      const token = await guestSession.acknowledgeDisclaimer();
      await load(days, token);
    } finally {
      setAcknowledging(false);
    }
  };

  const pickScope = (scope: (typeof SCOPES)[number]) => {
    if (!scope.guestAllowed) {
      setShowLockedNudge(true);
      return;
    }
    setShowLockedNudge(false);
    setDays(scope.days);
    if (stage === 'preview') void load(scope.days);
  };

  if (stage === 'loading') {
    return <LoadingState message="Putting together a sample plan…" />;
  }

  if (stage === 'disclaimer') {
    return (
      <Screen>
        <ScreenHeader title="Before you start" />
        <ScrollView style={styles.disclaimerBox} contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.disclaimerText}>{DISCLAIMER_TEXT}</Text>
        </ScrollView>
        <Button
          label="I understand"
          onPress={acknowledgeDisclaimer}
          loading={acknowledging}
          style={styles.actionSpacing}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="Plan your next few meals"
        subtitle="A preview of how Plan Ahead works — no account needed to look around."
      />

      <View style={styles.chipRow}>
        {SCOPES.map((s) => {
          const locked = !s.guestAllowed;
          const selected = days === s.days && !locked;
          return (
            <TouchableOpacity
              key={s.days}
              style={[styles.chip, selected && styles.chipSelected, locked && styles.chipLocked]}
              onPress={() => pickScope(s)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: locked }}
              accessibilityHint={locked ? 'Create a free account to plan more than tomorrow' : undefined}
            >
              <View style={styles.chipInner}>
                {locked ? <Feather name="lock" size={11} color={colors.textFaint} /> : null}
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                    locked && styles.chipTextLocked,
                  ]}
                >
                  {s.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {showLockedNudge ? (
        <Text style={styles.lockedNudge}>
          Planning more than tomorrow needs a free account.{' '}
          <Text style={styles.lockedNudgeLink} onPress={onRequestLogin} accessibilityRole="button">
            Create one
          </Text>{' '}
          to plan up to a full week.
        </Text>
      ) : null}

      {stage === 'idle' || stage === 'error' ? (
        <Button
          label={stage === 'error' ? 'Try again' : 'Show a sample plan'}
          onPress={start}
          style={styles.actionSpacing}
        />
      ) : null}
      {stage === 'error' ? (
        <Text style={styles.errorText}>
          {errorText ?? "Couldn't load a preview right now. Please try again."}
        </Text>
      ) : null}

      {stage === 'preview' ? (
        <>
          {preview.map(({ dayIndex, recipe }) => (
            <FadeInView key={dayIndex} delay={dayIndex * 40}>
              <Card style={styles.dayCard}>
                <View style={styles.dayRow}>
                  <Image
                    source={{ uri: getCuisineImage(recipe.cuisine).url }}
                    style={styles.dayImage}
                    accessibilityLabel={getCuisineImage(recipe.cuisine).alt}
                  />
                  <View style={styles.dayContent}>
                    <Text style={styles.dayLabel}>Day {dayIndex + 1}</Text>
                    <Text style={styles.dayTitle}>{recipe.title}</Text>
                    <View style={styles.tagRow}>
                      <Tag label={`${recipe.cookTimeMinutes} min`} />
                      <Tag label={`${recipe.servings} servings`} />
                      {recipe.cuisine ? <Tag label={recipe.cuisine} /> : null}
                    </View>
                  </View>
                </View>
              </Card>
            </FadeInView>
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
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
    },
    chipInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    chipSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    chipLocked: { opacity: 0.6, backgroundColor: c.surfaceSunken, borderStyle: 'dashed' },
    chipText: { fontSize: 13, color: c.text },
    chipTextSelected: { color: c.primary, fontWeight: '600' },
    chipTextLocked: { color: c.textFaint },
    lockedNudge: { ...typography.caption, color: c.textMuted, marginTop: spacing.sm, lineHeight: 18 },
    lockedNudgeLink: { color: c.primary, fontWeight: '600' },
    actionSpacing: { marginTop: spacing.xl },
    errorText: { color: c.danger, marginTop: spacing.md, fontSize: 14 },
    dayCard: { marginTop: spacing.md },
    dayRow: { flexDirection: 'row', gap: spacing.md },
    dayImage: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      backgroundColor: c.surfaceSunken,
    },
    dayContent: { flex: 1 },
    dayLabel: { ...typography.overline, color: c.textMuted, marginBottom: spacing.xs },
    dayTitle: { ...typography.title, color: c.text, marginBottom: spacing.sm },
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
