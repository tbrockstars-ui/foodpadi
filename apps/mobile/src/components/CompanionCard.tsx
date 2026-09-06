import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CompanionAction, CompanionSuggestionType, CompanionSuggestionView } from '@foodpadi/shared';
import { api } from '../api/client';
import { Card } from './Card';
import { FadeInView } from './motion/FadeInView';
import type { MainTabScreenProps } from '../navigation/types';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const ICON_BY_TYPE: Record<CompanionSuggestionType, string> = {
  usual_time: '🕰️',
  use_what_you_have: '🥘',
  goal_support: '🎯',
  variety: '🎲',
  routine: '📍',
  plan_support: '📅',
};

interface CompanionCardProps {
  navigation: MainTabScreenProps<'Home'>['navigation'];
  /** A 'decide'-targeted suggestion stays on Home — this lets HomeScreen fill/focus the DecideFlow already on screen instead of navigating anywhere. */
  onDecide: (promptFill?: string) => void;
}

/**
 * FoodPadi Memory & Companion's one piece of UI (brief §11/§28): at most one
 * calm card, Home-only, reusing the existing Decide/Cook/Eat Now/Plan flows
 * for every CTA — never a new flow, never a chatbot. Fetches its own
 * suggestion and fails silently (renders nothing) on any error, timeout, or
 * `null` — Companion is an enhancement, never a dependency, so a broken
 * network call here must never block or disturb the rest of Home.
 */
export function CompanionCard({ navigation, onDecide }: CompanionCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [suggestion, setSuggestion] = useState<CompanionSuggestionView | null>(null);
  const [settled, setSettled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getCompanionSuggestion()
      .then((res) => {
        if (!cancelled) setSuggestion(res.suggestion);
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null);
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // "Delivered" is already recorded server-side when the suggestion is
    // generated — this marks that it actually rendered in front of someone,
    // once per suggestion.
    if (suggestion) void api.sendCompanionAction(suggestion.id, 'opened');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.id]);

  if (!settled || !suggestion || hidden) return null;

  const act = (action: CompanionAction) => void api.sendCompanionAction(suggestion.id, action);

  const dismiss = (action: Extract<CompanionAction, 'dismissed' | 'not_useful' | 'do_not_remind'>) => {
    act(action);
    setHidden(true);
  };

  const onPressCta = () => {
    act('accepted');
    setHidden(true);
    switch (suggestion.ctaTarget) {
      case 'decide':
        onDecide(suggestion.ctaPayload?.promptFill);
        return;
      case 'cook':
        navigation.navigate('Cook', { initialIngredients: suggestion.ctaPayload?.initialIngredients });
        return;
      case 'eat_now':
        navigation.navigate('EatNow', {
          initialQuery: suggestion.ctaPayload?.initialQuery,
          whyLabel: suggestion.ctaPayload?.whyLabel,
        });
        return;
      case 'plan':
        navigation.navigate('Plan');
        return;
    }
  };

  return (
    <FadeInView style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.icon}>{ICON_BY_TYPE[suggestion.type] ?? '💬'}</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>{suggestion.title}</Text>
            <Text style={styles.body}>{suggestion.body}</Text>
          </View>
        </View>

        {/* "Why am I seeing this?" — always available, never hidden away
            behind a menu (brief §14, trust-critical). */}
        {showWhy ? (
          <Text style={styles.reason}>{suggestion.reason}</Text>
        ) : (
          <Text style={styles.whyLink} onPress={() => setShowWhy(true)} accessibilityRole="button">
            Why am I seeing this?
          </Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.ctaButton} onPress={onPressCta} accessibilityRole="button">
            <Text style={styles.ctaButtonText}>{suggestion.ctaLabel}</Text>
          </TouchableOpacity>
          <View style={styles.textActions}>
            <Text style={styles.textAction} onPress={() => dismiss('dismissed')} accessibilityRole="button">
              Not now
            </Text>
            <Text style={styles.textActionMuted} onPress={() => dismiss('not_useful')} accessibilityRole="button">
              Not useful
            </Text>
          </View>
        </View>
      </Card>
    </FadeInView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: spacing.lg },
    card: { paddingVertical: spacing.md },
    header: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    icon: { fontSize: 22, lineHeight: 26 },
    headerText: { flex: 1 },
    title: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
    body: { ...typography.body, color: c.textMuted },
    whyLink: { fontSize: 12, color: c.primary, fontWeight: '600', marginBottom: spacing.md },
    reason: { ...typography.caption, color: c.textMuted, marginBottom: spacing.md, fontStyle: 'italic' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    ctaButton: {
      backgroundColor: c.primary,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
    },
    ctaButtonText: { color: c.primaryText, fontSize: 13, fontWeight: '700' },
    textActions: { flexDirection: 'row', gap: spacing.md, marginLeft: 'auto' },
    textAction: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    textActionMuted: { fontSize: 12, color: c.textFaint },
  });
}
