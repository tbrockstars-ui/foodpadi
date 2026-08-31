import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { radius, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      minHeight: 48,
    },
    rowSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    rowPrimary: { borderColor: c.primary, backgroundColor: c.primary },
    rowDisabled: { opacity: 0.5 },
    text: { fontSize: 15, color: c.text, flexShrink: 1 },
    textSelected: { color: c.primary, fontWeight: '600' },
    textPrimary: { color: c.primaryText },
    check: { fontSize: 16, color: c.primary, fontWeight: '700', marginLeft: spacing.sm },
  });
}
