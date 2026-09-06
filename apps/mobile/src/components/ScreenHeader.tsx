import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { BackLink } from './BackLink';

interface Props {
  title: string;
  /** Optional one-line supporting text under the title. */
  subtitle?: string;
  /** Show a back pill above the title and wire it to this handler. */
  onBack?: () => void;
  backLabel?: string;
  /** Optional control aligned to the title's right edge (e.g. a text link). */
  trailing?: React.ReactNode;
}

/**
 * The page title block — an optional back pill, the screen title, and an
 * optional supporting line / trailing action. Consolidates the
 * `BackLink` + `<Text style={styles.title}>` + hard-coded `paddingTop: 56`
 * triplet that every screen re-implemented, so heading rhythm is identical
 * everywhere and lives in one file.
 */
export function ScreenHeader({ title, subtitle, onBack, backLabel = 'Back', trailing }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wrap}>
      {onBack ? <BackLink label={backLabel} onPress={onBack} /> : null}
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: spacing.lg },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
    title: { ...typography.display, color: c.text, flex: 1 },
    trailing: { paddingTop: spacing.xs },
    subtitle: { ...typography.body, color: c.textMuted, marginTop: spacing.xs },
  });
}
