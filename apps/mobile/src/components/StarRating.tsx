import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

/**
 * Read-only fractional star bar for a dealer's post-visit customer rating
 * (user instruction 2026-09-11) — e.g. ★★★★☆ 4.6 (23). Renders nothing when
 * there are no ratings yet (never shown as "0 stars").
 */
export function StarRating({
  average,
  count,
  size = 14,
  showCount = true,
}: {
  average: number | null;
  count: number;
  size?: number;
  showCount?: boolean;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  if (average == null || count === 0) return null;
  const pct = `${(Math.max(0, Math.min(5, average)) / 5) * 100}%` as const;

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${average.toFixed(1)} out of 5 stars, from ${count} rating${count === 1 ? '' : 's'}`}
    >
      <View style={styles.stack}>
        <Text style={[styles.starsBg, { fontSize: size }]}>★★★★★</Text>
        <View style={[styles.fgClip, { width: pct }]}>
          <Text style={[styles.starsFg, { fontSize: size }]}>★★★★★</Text>
        </View>
      </View>
      {showCount ? (
        <Text style={[styles.count, { fontSize: size * 0.78 }]}>
          {average.toFixed(1)} ({count})
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    stack: { position: 'relative' },
    starsBg: { color: c.border, letterSpacing: 1 },
    fgClip: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
    starsFg: { color: '#f5a623', letterSpacing: 1 },
    count: { color: c.textMuted },
  });
}
