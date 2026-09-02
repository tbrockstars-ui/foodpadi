import React, { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { REFERRAL_TIERS, type ReferralSummary } from '@foodpadi/shared';
import { api } from '../api/client';
import { BackLink } from '../components/BackLink';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Invite'>;

const SHARE_MESSAGE =
  "🍽️ I found something I think you'd like. FoodPadi helped me decide what to eat.";

/**
 * "Feed a Friend" dashboard — mobile twin of apps/web/app/invite/InviteView.tsx.
 * Referral is a key acquisition channel (docs/REFERRAL_PLAN.md), so it's a
 * first-class screen, not just a button in Profile.
 */
export function InviteScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [celebrated, setCelebrated] = useState<ReferralSummary['unseen']>([]);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getReferralSummary();
      setLoadFailed(false);
      setSummary(data);
      if (data.unseen.length > 0) {
        setCelebrated(data.unseen);
        void api.ackReferralMilestones();
      }
    } catch {
      // Without this the screen sat on the spinner forever whenever the
      // request failed — most often because the referrals API isn't live on
      // this environment yet.
      setLoadFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shareInvite = async () => {
    if (!summary) return;
    setSharing(true);
    try {
      const result = await Share.share({ message: `${SHARE_MESSAGE} Try it: ${summary.link}` });
      if (result.action === Share.sharedAction) void api.trackReferralShare('native');
    } catch {
      // Sheet dismissed — nothing to surface.
    } finally {
      setSharing(false);
    }
  };

  if (!summary) {
    if (loadFailed) {
      return (
        <View style={styles.container}>
          <BackLink label="Back" onPress={() => navigation.goBack()} />
          <EmptyState
            title="Couldn't load your invites"
            body="Check your connection and try again. Inviting friends may not be available on this build yet."
            actionLabel="Try again"
            onAction={() => {
              setLoadFailed(false);
              void load();
            }}
          />
        </View>
      );
    }
    return <LoadingState message="Loading your invites…" />;
  }

  const { tier, nextTier, counts } = summary;
  const progressPct = nextTier
    ? Math.min(100, Math.round((counts.qualified / nextTier.threshold) * 100))
    : 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <BackLink label="Back" onPress={() => navigation.goBack()} />
      <Text style={styles.title}>Invite a friend</Text>
      <Text style={styles.lede}>
        Know someone who always says &ldquo;I don&apos;t know what to eat&rdquo;? Send them FoodPadi.
        When a friend joins through your link and makes their first food decision, it counts here.
      </Text>

      {celebrated.length > 0 ? (
        <Card style={[styles.section, styles.celebrate]}>
          <TouchableOpacity
            style={styles.celebrateClose}
            onPress={() => setCelebrated([])}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.celebrateCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.celebrateTitle}>Nice work! 🎉</Text>
          {celebrated.map((m) => (
            <Text key={`${m.kind}-${m.label}`} style={styles.celebrateLine}>
              {m.icon}{' '}
              {m.kind === 'joined_via_friend'
                ? 'You joined FoodPadi through a friend — welcome!'
                : `You reached ${m.label}`}
            </Text>
          ))}
        </Card>
      ) : null}

      <Text style={styles.sectionHeading}>Your invite link</Text>
      <Card style={styles.section}>
        <Text style={styles.link} selectable>
          {summary.link}
        </Text>
        <Button
          label={sharing ? 'Opening…' : 'Share invite link'}
          onPress={shareInvite}
          loading={sharing}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Text style={styles.sectionHeading}>Progress</Text>
      <Card style={styles.section}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.joined}</Text>
            <Text style={styles.statLabel}>Friends joined</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.qualified}</Text>
            <Text style={styles.statLabel}>Made a food decision</Text>
          </View>
        </View>

        <Text style={styles.tierNow}>{tier ? `${tier.icon} ${tier.label}` : 'Not started yet'}</Text>
        {nextTier ? (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.hint}>
              {nextTier.remaining} more {nextTier.remaining === 1 ? 'friend' : 'friends'} to reach{' '}
              {nextTier.icon} {nextTier.label}.
            </Text>
          </>
        ) : (
          <Text style={styles.hint}>You&apos;ve reached the top tier — thank you for spreading FoodPadi.</Text>
        )}

        <View style={styles.ladder}>
          {REFERRAL_TIERS.map((t) => {
            const reached = counts.qualified >= t.threshold;
            return (
              <View key={t.threshold} style={[styles.ladderItem, !reached && styles.ladderLocked]}>
                <Text style={styles.ladderIcon}>{t.icon}</Text>
                <Text style={styles.ladderLabel}>{t.label}</Text>
                <Text style={styles.ladderThreshold}>
                  {t.threshold} {t.threshold === 1 ? 'friend' : 'friends'}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Text style={styles.sectionHeading}>Recent invites</Text>
      <Card style={styles.section}>
        {summary.recent.length === 0 ? (
          <Text style={styles.emptyText}>No one has joined through your link yet.</Text>
        ) : (
          summary.recent.map((item, i) => (
            <View key={`${item.maskedHandle}-${i}`} style={styles.recentRow}>
              <Text style={styles.recentHandle}>{item.maskedHandle}</Text>
              <Text style={[styles.recentBadge, item.status !== 'pending' && styles.recentBadgeActive]}>
                {item.status === 'pending' ? 'Joined' : 'Active'}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: spacing.xl, paddingTop: 56 },
    title: { ...typography.display, color: c.text, marginBottom: spacing.sm },
    lede: { ...typography.body, color: c.textMuted, marginBottom: spacing.lg },
    sectionHeading: { ...typography.label, color: c.textMuted, marginBottom: spacing.sm, marginTop: spacing.lg },
    section: { marginBottom: spacing.sm },
    celebrate: { backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.primary },
    celebrateClose: { position: 'absolute', top: 6, right: 8, padding: 6 },
    celebrateCloseText: { color: c.textMuted, fontSize: 14 },
    celebrateTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
    celebrateLine: { ...typography.body, color: c.primaryDark, marginTop: 2 },
    link: { ...typography.body, color: c.text, fontFamily: 'monospace' },
    statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    stat: {
      flex: 1,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    statValue: { fontSize: 28, fontWeight: '700', color: c.text },
    statLabel: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs, textAlign: 'center' },
    tierNow: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.md },
    progressTrack: {
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: c.primary, borderRadius: radius.pill },
    hint: { ...typography.caption, color: c.textFaint, marginTop: spacing.sm, lineHeight: 18 },
    ladder: { marginTop: spacing.lg, gap: spacing.sm },
    ladderItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    ladderLocked: { opacity: 0.45 },
    ladderIcon: { fontSize: 16, width: 24, textAlign: 'center' },
    ladderLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
    ladderThreshold: { ...typography.caption, color: c.textFaint },
    emptyText: { ...typography.body, color: c.textFaint },
    recentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    recentHandle: { ...typography.body, color: c.text, flex: 1 },
    recentBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
      backgroundColor: c.surfaceSunken,
      paddingVertical: 2,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    recentBadgeActive: { color: c.primary, backgroundColor: c.primarySoft },
  });
}
