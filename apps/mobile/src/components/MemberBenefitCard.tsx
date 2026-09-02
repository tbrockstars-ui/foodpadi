import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  /** Leading emoji, e.g. "✨" / "🔖" / "🧠". */
  icon?: string;
  title: string;
  body: string;
  /** Optional benefit checklist (guest-mode brief §8/§20). */
  bullets?: string[];
  ctaLabel: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The contextual "let FoodPadi remember you" card (guest-mode brief §20).
 * Inline and non-blocking — it sits alongside content a guest is already
 * looking at, unlike SignupPromptModal which overlays at the moment a guest
 * tries an account-only action. Frequency of appearance is the caller's
 * job via lib/guestPrompts.ts.
 */
export function MemberBenefitCard({ icon, title, body, bullets, ctaLabel, onPress, style }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Card style={[styles.card, style]}>
      <Text style={styles.title}>
        {icon ? `${icon}  ` : ''}
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {bullets && bullets.length > 0 ? (
        <View style={styles.bullets}>
          {bullets.map((line) => (
            <Text key={line} style={styles.bullet}>
              ✓  {line}
            </Text>
          ))}
        </View>
      ) : null}
      <Button label={ctaLabel} onPress={onPress} style={styles.cta} />
    </Card>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: c.primarySoft, marginTop: spacing.lg },
    title: { ...typography.title, color: c.text, marginBottom: spacing.sm },
    body: { ...typography.body, color: c.textMuted },
    bullets: { marginTop: spacing.md, gap: spacing.xs },
    bullet: { ...typography.body, color: c.text },
    cta: { marginTop: spacing.lg },
  });
}
