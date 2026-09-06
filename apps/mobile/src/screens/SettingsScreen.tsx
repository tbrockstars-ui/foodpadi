import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ListRow, RowGroup } from '../components/ListRow';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { spacing, radius, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from '../navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'> & {
  onRequestLogin: () => void;
};

/**
 * Settings — the mobile counterpart to apps/web/app/SettingsMenu.tsx. Uses
 * the shared Section + ListRow primitives (the "Manage settings" grouped-row
 * pattern) so it reads the same as Profile.
 *
 * A guest sees only what applies signed-out: the theme toggle and a prompt
 * to create an account. No account rows, no subscription, no "Log out" —
 * they were never logged in.
 */
export function SettingsScreen({ navigation, onRequestLogin }: Props) {
  const { user, logout } = useAuth();
  const isGuest = !user;
  const { scheme, colors, setScheme } = useTheme();
  const s = makeStyles(colors);

  // FoodPadi Memory & Companion (brief §13) — members only, and loaded lazily
  // so a failure here never blocks the rest of Settings (the row simply
  // doesn't render, same "enhancement, not a dependency" rule as Home's card).
  const [companionEnabled, setCompanionEnabled] = useState<boolean | null>(null);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    api
      .getCompanionPreferences()
      .then((prefs) => setCompanionEnabled(prefs.enabled))
      .catch(() => setCompanionEnabled(null));
  }, [isGuest]);

  const toggleCompanion = async () => {
    if (companionEnabled === null || companionBusy) return;
    const next = !companionEnabled;
    setCompanionBusy(true);
    setCompanionEnabled(next); // optimistic — this is a plain preference flip, not a risky action
    try {
      await api.updateCompanionPreferences({ enabled: next });
    } catch {
      setCompanionEnabled(!next); // failed — put it back rather than show a wrong state
    } finally {
      setCompanionBusy(false);
    }
  };

  const resetCompanionMemory = async () => {
    setResetting(true);
    try {
      await api.resetCompanionMemory();
      setConfirmingReset(false);
      setResetDone(true);
    } finally {
      setResetting(false);
    }
  };

  const appearance = (
    <Section title="Appearance">
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
    </Section>
  );

  if (isGuest) {
    return (
      <Screen scroll>
        <ScreenHeader title="Settings" onBack={() => navigation.goBack()} backLabel="Back" />
        {appearance}
        <MemberBenefitCard
          icon="✨"
          title="Make FoodPadi yours"
          body="Create a free account to save recipes and plans, keep your preferences, and pick up where you left off."
          ctaLabel="Log in or create a free account"
          onPress={onRequestLogin}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} backLabel="Back" />

      <Section title="Account">
        <RowGroup>
          <ListRow
            icon="sliders"
            label="Cuisines &amp; avoided foods"
            onPress={() => navigation.navigate('Cuisines')}
          />
          <ListRow icon="bookmark" label="Saved recipes" onPress={() => navigation.navigate('SavedRecipes')} />
          <ListRow icon="calendar" label="Saved plans" onPress={() => navigation.navigate('SavedPlans')} />
        </RowGroup>
      </Section>

      {appearance}

      {companionEnabled !== null ? (
        <Section title="FoodPadi Companion">
          <Text style={s.companionBlurb}>
            FoodPadi learns from your own food choices — like when you usually decide, and what you tend to
            have on hand — to occasionally suggest what to eat. It never shares this with anyone, and you can
            turn it off or clear it at any time.
          </Text>
          <RowGroup>
            <ListRow
              label="Helpful suggestions"
              detail="A calm suggestion on Home, at most once a day"
              value={companionEnabled ? 'On' : 'Off'}
              onPress={toggleCompanion}
              hideChevron
            />
            {!confirmingReset ? (
              <ListRow
                icon="rotate-ccw"
                label={resetDone ? 'Learned patterns cleared' : 'Reset learned patterns'}
                onPress={resetDone ? undefined : () => setConfirmingReset(true)}
                hideChevron={resetDone}
              />
            ) : null}
          </RowGroup>

          {confirmingReset ? (
            <Card style={s.companionConfirmBox}>
              <Text style={s.companionConfirmText}>
                This clears what FoodPadi has learned from your food choices so far — your saved recipes,
                plans, goals and preferences are untouched. FoodPadi starts learning again from here.
              </Text>
              <View style={s.confirmRow}>
                <Button label="Cancel" variant="secondary" onPress={() => setConfirmingReset(false)} style={{ flex: 1 }} />
                <Button label="Reset" onPress={resetCompanionMemory} loading={resetting} style={{ flex: 1 }} />
              </View>
            </Card>
          ) : null}
        </Section>
      ) : null}

      <Section title="Subscription">
        <RowGroup>
          <ListRow
            icon="credit-card"
            label="Subscription &amp; payments"
            badge="Free"
            onPress={() => navigation.navigate('Subscription')}
          />
        </RowGroup>
      </Section>

      <RowGroup>
        <ListRow icon="log-out" label="Log out" onPress={logout} destructive hideChevron />
      </RowGroup>
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
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
    companionBlurb: { ...typography.caption, color: c.textMuted, lineHeight: 18, marginBottom: spacing.md },
    companionConfirmBox: { backgroundColor: c.surfaceSunken, marginTop: spacing.md },
    companionConfirmText: { ...typography.caption, color: c.text, marginBottom: spacing.md, lineHeight: 18 },
    confirmRow: { flexDirection: 'row', gap: spacing.sm },
  });
}
