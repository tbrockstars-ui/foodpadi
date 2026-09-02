import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { radius, shadow, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}

/**
 * Previously each screen redefined its own
 * `{ backgroundColor: surface, borderRadius, ...shadow.card }` object.
 */
export function Card({ children, onPress, style, raised }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const cardStyle = [styles.base, raised && shadow.raised, !raised && shadow.card, style];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} accessibilityRole="button">
        {children}
      </TouchableOpacity>
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
