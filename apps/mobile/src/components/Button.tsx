import React from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { radius, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { usePressScale } from './motion/usePressScale';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * The single source of truth for button styling. `primary` (filled green),
 * `secondary` (outline), `tertiary` (text-only) let a screen express a
 * three-level action hierarchy using the existing palette instead of
 * stacking three filled buttons (visual-redesign brief §8). `danger` is an
 * outline destructive style.
 */
export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const { colors } = useTheme();
  const { styles, variantStyles, variantTextStyles } = makeStyles(colors);
  const press = usePressScale();
  const isDisabled = disabled || loading;
  return (
    <AnimatedTouchable
      style={[
        styles.base,
        variant === 'tertiary' && styles.tertiaryBase,
        variantStyles[variant],
        isDisabled && styles.disabled,
        press.style,
        style,
      ]}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryText : colors.textMuted} />
      ) : (
        <Text style={[styles.label, variantTextStyles[variant]]}>{label}</Text>
      )}
    </AnimatedTouchable>
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
    tertiaryBase: { paddingVertical: spacing.sm },
    disabled: { opacity: 0.4 },
    label: { fontSize: 16, fontWeight: '600' },
  });

  const variantStyles: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
    tertiary: { backgroundColor: 'transparent' },
    danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.danger },
  };

  const variantTextStyles: Record<Variant, { color: string }> = {
    primary: { color: c.primaryText },
    secondary: { color: c.textMuted },
    tertiary: { color: c.primary },
    danger: { color: c.danger },
  };

  return { styles, variantStyles, variantTextStyles };
}
