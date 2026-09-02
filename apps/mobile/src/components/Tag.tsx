import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

function toneFor(c: ThemeColors, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'neutral':
      return { bg: c.surfaceSunken, fg: c.textFaint };
    case 'success':
      return { bg: c.successSoft, fg: c.success };
    case 'warning':
      return { bg: c.warningSoft, fg: c.warning };
    case 'danger':
      return { bg: c.dangerSoft, fg: c.danger };
    default:
      return { bg: c.secondarySoft, fg: c.secondary };
  }
}

export function Tag({ label, tone = 'accent' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const { bg, fg } = toneFor(colors, tone);
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 12, fontWeight: '600' },
});
