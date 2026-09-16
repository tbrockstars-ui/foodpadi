import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/**
 * The FoodPadi Verified mark — a small filled green circle with a white check,
 * the same visual language as X/Twitter's verified checkmark (user request
 * 2026-09-11), shown inline next to a dealer's name. No react-native-svg
 * dependency in this app, so this is a plain View/Text circle rather than the
 * scalloped-badge SVG the web uses — same colour, same meaning.
 *
 * Only ever rendered from `isVerified` on the API response, which is only ever
 * true once FoodPadi has actually completed verification (brief §23) — never
 * implied by an active subscription alone.
 */
export function VerifiedBadge({ size = 15 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="FoodPadi Verified"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.success },
      ]}
    >
      <Text style={[styles.check, { fontSize: size * 0.62 }]}>✓</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontWeight: '900' },
});
