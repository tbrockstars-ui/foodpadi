import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { CompanionCard } from '../components/CompanionCard';
import { DecideFlow, type DecideFlowHandle } from '../components/DecideFlow';
import { FriendWelcomeBanner } from '../components/FriendWelcomeBanner';
import { Screen } from '../components/Screen';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { MainTabScreenProps } from '../navigation/types';

type Props = MainTabScreenProps<'Home'> & { onRequestLogin: () => void };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstNameFrom(displayName: string | null | undefined, email: string | undefined): string | null {
  const name = displayName?.trim() || email?.split('@')[0].trim();
  if (!name) return null;
  return name.split(/[\s._-]+/)[0];
}

/**
 * Home is the single intent-first entry point (decision-engine architecture
 * memory). After the declutter pass it holds exactly one job — "What should
 * I eat?" — with DecideFlow as the one dominant element. Cook and Plan moved
 * to the tab bar; Scan moved into the Cook tab; Settings/Login moved into
 * Profile. Guests get a one-line nudge here; the fuller "make FoodPadi
 * yours" card still appears inside DecideFlow after they've used it a couple
 * of times (existing guestPrompts throttle).
 */
export function HomeScreen({ onRequestLogin, navigation }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const isGuest = !user;
  const firstName = firstNameFrom(user?.displayName, user?.email);
  const decideRef = useRef<DecideFlowHandle>(null);

  return (
    <Screen scroll>
      <Text style={styles.brand}>FoodPadi</Text>
      <Text style={styles.greeting}>
        {greeting()}
        {firstName ? `, ${firstName}` : ''}
      </Text>

      <Text style={styles.heading}>What should I eat?</Text>
      <Text style={styles.subtitle}>
        Tell FoodPadi what you have or what you&apos;re after, and it&apos;ll decide.
      </Text>

      {!isGuest ? <FriendWelcomeBanner /> : null}

      {/* Memory & Companion's one piece of UI — members only (guests get zero
          persistent behavioural profiling), Home-only, at most one suggestion. */}
      {!isGuest ? (
        <CompanionCard navigation={navigation} onDecide={(promptFill) => decideRef.current?.focusWithPrompt(promptFill)} />
      ) : null}

      <View style={styles.decideWrap}>
        <DecideFlow ref={decideRef} onRequestLogin={onRequestLogin} navigation={navigation} />
      </View>

      {isGuest ? (
        <Text style={styles.guestNote} onPress={onRequestLogin} accessibilityRole="button">
          Deciding and cooking work without an account.{' '}
          <Text style={styles.guestNoteLink}>Create a free one</Text> and FoodPadi remembers your
          recipes, preferences and plans.
        </Text>
      ) : (
        <Text style={styles.companionNote}>
          Nothing planned yet — open the Plan tab whenever you want to look ahead.
        </Text>
      )}
    </Screen>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    brand: { ...typography.label, color: c.textMuted, letterSpacing: 1 },
    greeting: { ...typography.body, color: c.textMuted, marginTop: spacing.xs },
    heading: { ...typography.display, color: c.text, marginTop: spacing.lg, marginBottom: spacing.xs },
    subtitle: { ...typography.body, color: c.textMuted, marginBottom: spacing.lg },
    decideWrap: { marginBottom: spacing.lg },
    guestNote: { ...typography.caption, color: c.textMuted, lineHeight: 19 },
    guestNoteLink: { color: c.primary, fontWeight: '600' },
    companionNote: { ...typography.caption, color: c.textFaint, lineHeight: 19 },
  });
}
