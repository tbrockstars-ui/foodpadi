import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
}

/**
 * The selectable-pill pattern, previously duplicated with slightly
 * different styling in GoalScreen, PreferencesScreen, and CookTodayScreen.
 */
export function Chip({ label, selected, onPress, role = 'checkbox' }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ selected, checked: selected }}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  text: { fontSize: 14, color: colors.text },
  textSelected: { color: colors.primary, fontWeight: '600' },
});
