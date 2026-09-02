import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ADS_ENABLED, type AdPlacement } from '../constants/ads';
import { radius, spacing, typography, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  placement: AdPlacement;
  style?: StyleProp<ViewStyle>;
}

/**
 * A reserved position for a future guest ad (guest-mode brief §14). Renders
 * nothing until ADS_ENABLED is turned on; when it is, a labelled placeholder
 * — never a real or fake ad network. Callers only mount this for guests and
 * only in the approved positions (below Decide results, foot of Eat Now
 * results) — never inside Cooking Mode, over ingredients/timers, or right
 * before a primary action.
 */
export function AdSlot({ placement, style }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  if (!ADS_ENABLED) return null;
  return (
    <View style={[styles.slot, style]} accessibilityLabel="Advertisement placeholder">
      <Text style={styles.label}>Ad placeholder · {placement}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    slot: {
      marginTop: spacing.lg,
      paddingVertical: spacing.xl,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
      borderRadius: radius.md,
      alignItems: 'center',
      backgroundColor: c.surfaceSunken,
    },
    label: { ...typography.caption, color: c.textFaint },
  });
}
