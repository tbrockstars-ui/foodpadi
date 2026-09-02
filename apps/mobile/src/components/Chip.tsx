import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { radius, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
    },
    chipSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    text: { fontSize: 14, color: c.text },
    textSelected: { color: c.primary, fontWeight: '600' },
  });
}
