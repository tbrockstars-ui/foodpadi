import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { radius, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single source of truth for button styling — previously each screen
 * (AuthScreen, GoalScreen, PreferencesScreen, CookTodayScreen) defined its
 * own near-identical primary/secondary TouchableOpacity + StyleSheet pair.
 */
export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const { colors } = useTheme();
  const { styles, variantStyles, variantTextStyles } = makeStyles(colors);
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryText : colors.textMuted} />
      ) : (
        <Text style={[styles.label, variantTextStyles[variant]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  const styles = StyleSheet.create({
    base: {
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: { opacity: 0.4 },
    label: { fontSize: 16, fontWeight: '600' },
  });

  const variantStyles: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
    danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.danger },
  };

  const variantTextStyles: Record<Variant, { color: string }> = {
    primary: { color: c.primaryText },
    secondary: { color: c.textMuted },
    danger: { color: c.danger },
  };

  return { styles, variantStyles, variantTextStyles };
}
