import React, { useCallback, useState } from 'react';
import { LayoutAnimation, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DISCLAIMER_TEXT, type UserSummary } from '@foodpadi/shared';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DisclaimerBanner } from '../components/DisclaimerBanner';
import { ListRow, RowGroup } from '../components/ListRow';
import { MemberBenefitCard } from '../components/MemberBenefitCard';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { UserAvatar } from '../components/UserAvatar';
import { useReduceMotion } from '../components/motion/useReduceMotion';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { MainTabScreenProps } from '../navigation/types';

type Props = MainTabScreenProps<'Profile'> & { onRequestLogin: () => void };

/** Right-aligned badge on the Subscription row — reflects the access tier
 *  (Guest/Trial/Paid). `profile` is null until /users/me resolves. */
function subscriptionBadge(profile: UserSummary | null): string {
  if (profile?.entitlement === 'paid') return 'Premium';
  if (profile?.entitlement === 'trial') {
    if (!profile.trialEndsAt) return 'Trial';
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(profile.trialEndsAt).getTime() - Date.now()) / 86_400_000),
    );
    return daysLeft > 0 ? `Trial · ${daysLeft}d` : 'Trial ending';
  }
  return 'Free';
}

/**
 * Profile is the organised home for everything that isn't a primary job
 * (declutter pass §12): clean grouped rows in the reference "Manage
 * settings" style, not a long scroll of colourful cards and inline inputs.
 * The cuisine / avoided-food editors moved to their own CuisinesScreen;
 * goals to EditGoals. Privacy (export / delete) stays here because it's
 * where someone looks for it. Guests land here too now (it's a tab) — they
 * get a sign-in prompt and the couple of rows that make sense signed-out,
 * never a wall of locked rows.
 */
export function ProfileScreen({ navigation, onRequestLogin }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user, logout } = useAuth();
  const isGuest = !user;
  const reduceMotion = useReduceMotion();

  const [profile, setProfile] = useState<UserSummary | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [exportedData, setExportedData] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isGuest) return;
      api.me().then(setProfile).catch(() => {});
    }, [isGuest]),
  );

  const toggle = (fn: () => void) => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    fn();
  };

  const exportMyData = async () => {
    const data = await api.exportData();
    toggle(() => setExportedData(JSON.stringify(data, null, 2)));
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await api.deleteAccount();
      await logout();
    } finally {
      setDeleting(false);
    }
  };

  if (isGuest) {
    return (
      <Screen scroll>
        <ScreenHeader title="You" />
        <MemberBenefitCard
          icon="✨"
          title="Make FoodPadi yours"
          body="Deciding what to eat and Cook Today work without an account. Create a free one and FoodPadi remembers your recipes, your preferences and your plans."
          ctaLabel="Log in or create a free account"
          onPress={onRequestLogin}
        />

        <Section title="FoodPadi" style={styles.guestSection}>
          <RowGroup>
            <ListRow icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} />
            <ListRow
              icon="shield"
              label="Food &amp; safety info"
              onPress={() => toggle(() => setShowDisclaimer((v) => !v))}
              hideChevron
            />
          </RowGroup>
        </Section>
        {showDisclaimer ? (
          <Card style={styles.disclaimerCard}>
            <Text style={styles.disclaimerFull}>{DISCLAIMER_TEXT}</Text>
          </Card>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title="You"
        subtitle={profile?.email}
        trailing={
          <TouchableOpacity
            onPress={() => navigation.navigate('EditAvatar')}
            accessibilityLabel="Choose your avatar"
          >
            <UserAvatar
              displayName={null}
              email={profile?.email}
              avatarId={profile?.avatarId}
              size={44}
            />
          </TouchableOpacity>
        }
      />

      <Section title="My FoodPadi">
        <RowGroup>
          <ListRow icon="smile" label="Choose your avatar" onPress={() => navigation.navigate('EditAvatar')} />
          <ListRow
            icon="sliders"
            label="Cuisines &amp; avoided foods"
            onPress={() => navigation.navigate('Cuisines')}
          />
          <ListRow icon="target" label="Food &amp; lifestyle goals" onPress={() => navigation.navigate('EditGoals')} />
          <ListRow icon="heart" label="Favourites" onPress={() => navigation.navigate('Favorites')} />
          <ListRow icon="bookmark" label="Saved recipes" onPress={() => navigation.navigate('SavedRecipes')} />
          <ListRow icon="calendar" label="Meal plans" onPress={() => navigation.navigate('SavedPlans')} />
        </RowGroup>
      </Section>

      <Section title="Account">
        <RowGroup>
          <ListRow icon="gift" label="Invite friends" onPress={() => navigation.navigate('Invite')} />
          <ListRow
            icon="credit-card"
            label="Subscription"
            badge={subscriptionBadge(profile)}
            onPress={() => navigation.navigate('Subscription')}
          />
          <ListRow icon="settings" label="Settings" onPress={() => navigation.navigate('Settings')} />
          <ListRow
            icon="shield"
            label="Food &amp; safety info"
            onPress={() => toggle(() => setShowDisclaimer((v) => !v))}
            hideChevron
          />
        </RowGroup>
        {showDisclaimer ? (
          <Card style={styles.disclaimerCard}>
            <Text style={styles.disclaimerFull}>{DISCLAIMER_TEXT}</Text>
          </Card>
        ) : null}
      </Section>

      <Section title="Privacy &amp; data">
        <RowGroup>
          <ListRow icon="download" label="Export my data" onPress={exportMyData} hideChevron />
          {!confirmingDelete ? (
            <ListRow
              icon="trash-2"
              label="Delete my account"
              onPress={() => toggle(() => setConfirmingDelete(true))}
              destructive
              hideChevron
            />
          ) : null}
        </RowGroup>

        {exportedData ? (
          <ScrollView style={styles.exportBox} nestedScrollEnabled>
            <Text style={styles.exportText}>{exportedData}</Text>
          </ScrollView>
        ) : null}

        {confirmingDelete ? (
          <Card style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              This permanently deletes your account and everything FoodPadi has stored about you. This
              can&apos;t be undone.
            </Text>
            <View style={styles.confirmRow}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => toggle(() => setConfirmingDelete(false))}
                style={{ flex: 1 }}
              />
              <Button
                label="Delete permanently"
                variant="danger"
                onPress={deleteAccount}
                loading={deleting}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}
      </Section>

      <Button label="Log out" variant="secondary" onPress={logout} />
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    guestSection: { marginTop: spacing.xl },
    disclaimerCard: { marginTop: spacing.md },
    disclaimerFull: { fontSize: 13, lineHeight: 20, color: c.text },
    exportBox: {
      maxHeight: 220,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    exportText: { fontSize: 11, color: c.textMuted, fontFamily: 'monospace' },
    confirmBox: { backgroundColor: c.dangerSoft, marginTop: spacing.md },
    confirmText: { ...typography.caption, color: c.danger, marginBottom: spacing.md, lineHeight: 18 },
    confirmRow: { flexDirection: 'row', gap: spacing.sm },
  });
}
