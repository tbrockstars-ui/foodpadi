import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { layout, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/**
 * A confident, full-size section header — the "By service" / "General"
 * treatment from the reference settings screen, rather than a tiny muted
 * uppercase caption floating above a card. `SettingsScreen` hand-rolled
 * this; it's now shared so Profile, Settings and any grouped surface read
 * the same.
 */
export function SectionHeader({ title, aside }: { title: string; aside?: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.headerRow}>
      <Text style={styles.headerText} accessibilityRole="header">
        {title}
      </Text>
      {aside ? <Text style={styles.aside}>{aside}</Text> : null}
    </View>
  );
}

interface SectionProps {
  title?: string;
  aside?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tighten the gap below (e.g. two related sections that belong together). */
  compact?: boolean;
}

/** Header + content with the standard inter-section gap. */
export function Section({ title, aside, children, style, compact }: SectionProps) {
  const styles = makeStyles(useTheme().colors);
  return (
    <View style={[compact ? styles.sectionCompact : styles.section, style]}>
      {title ? <SectionHeader title={title} aside={aside} /> : null}
      {children}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: layout.sectionGap },
    sectionCompact: { marginBottom: spacing.md },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    headerText: { ...typography.heading, color: c.text },
    aside: { ...typography.caption, color: c.textMuted },
  });
}
