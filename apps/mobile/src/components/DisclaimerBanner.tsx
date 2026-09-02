import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radius, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/**
 * The compact, non-frightening disclaimer strip (brief §14) — distinct from
 * DisclaimerScreen's full onboarding text. Neutral background, small text,
 * no warning icon/colour; the point is calm transparency, not alarm.
 */
export function DisclaimerBanner({ onReadMore }: { onReadMore: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        FoodPadi provides general food information and planning support. It does not monitor
        allergies or medical conditions and does not determine whether food is medically safe for
        you. Always check current product, menu and preparation information yourself.
      </Text>
      <TouchableOpacity onPress={onReadMore} accessibilityRole="button">
        <Text style={styles.link}>Read full disclaimer</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    text: { fontSize: 12, lineHeight: 17, color: c.textMuted, marginBottom: spacing.xs },
    link: { fontSize: 12, color: c.primary, fontWeight: '600' },
  });
}
