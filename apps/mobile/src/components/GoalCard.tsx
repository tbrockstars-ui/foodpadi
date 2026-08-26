import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  label: string;
  selected: boolean;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
  role?: 'checkbox' | 'radio';
}

/**
 * Full-width selectable row for Food & Lifestyle Goals — kept distinct from
 * Chip (docs/FOODPADI_DESIGN_SYSTEM.md §7: long goal labels read better as
 * rows than wrapped pills). `primary` layers a solid-fill treatment on top
 * of the normal selected state, for the "which is your main priority" step.
 */
export function GoalCard({ label, selected, primary, disabled, onPress, role = 'checkbox' }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        selected && styles.rowSelected,
        primary && styles.rowPrimary,
        disabled && styles.rowDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={{ selected, disabled: !!disabled }}
    >
      <Text style={[styles.text, selected && styles.textSelected, primary && styles.textPrimary]}>{label}</Text>
      {selected ? (
        <Text style={[styles.check, primary && styles.textPrimary]} accessibilityElementsHidden>
          ✓
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
  rowDisabled: { opacity: 0.5 },
  text: { fontSize: 15, color: colors.text, flexShrink: 1 },
  textSelected: { color: colors.primary, fontWeight: '600' },
  textPrimary: { color: colors.primaryText },
  check: { fontSize: 16, color: colors.primary, fontWeight: '700', marginLeft: spacing.sm },
});
