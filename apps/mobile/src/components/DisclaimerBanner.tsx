import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

/**
 * The compact, non-frightening disclaimer strip (brief §14) — distinct from
 * DisclaimerScreen's full onboarding text. Neutral background, small text,
 * no warning icon/colour; the point is calm transparency, not alarm.
 */
export function DisclaimerBanner({ onReadMore }: { onReadMore: () => void }) {
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  text: { fontSize: 12, lineHeight: 17, color: colors.textMuted, marginBottom: spacing.xs },
  link: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
