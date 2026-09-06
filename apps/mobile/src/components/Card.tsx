import React from 'react';
import { Animated, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { radius, shadow, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { usePressScale } from './motion/usePressScale';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Previously each screen redefined its own
 * `{ backgroundColor: surface, borderRadius, ...shadow.card }` object.
 * A pressable Card now also gets the shared subtle press-scale
 * (visual-redesign brief §19).
 */
export function Card({ children, onPress, style, raised }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const press = usePressScale();
  const cardStyle = [styles.base, raised && shadow.raised, !raised && shadow.card, style];

  if (onPress) {
    return (
      <AnimatedTouchable
        style={[cardStyle, press.style]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
      >
        {children}
      </AnimatedTouchable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    base: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
  });
}
