import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
}

/**
 * The "‹ Home" / "‹ Back" pattern repeated (bare text, no styling beyond a
 * muted colour) across every screen's top-left corner — consolidated into
 * one component so all of them look and feel the same, and so a redesign is
 * a one-file change instead of nine. Web counterpart: components/BackLink.tsx.
 * A plain Text chevron rather than an icon library — no react-native-svg (or
 * similar) dependency in this project yet, and adding one just for this
 * would need a new native build to actually take effect.
 */
export function BackLink({ label, onPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} accessibilityRole="button">
      <Text style={styles.chevron}>‹</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  chevron: { fontSize: 17, fontWeight: '700', color: colors.textMuted, lineHeight: 17 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
});
