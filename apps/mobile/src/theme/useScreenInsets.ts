import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from './colors';

/**
 * Padding that keeps a screen's content clear of the Android status bar and
 * the gesture / navigation bar. Expo SDK 54 (RN 0.81) draws every Android app
 * edge-to-edge and there's no opt-out, so screens that only had
 * `paddingBottom: spacing.xxl` had their bottom buttons sliding under the
 * system nav bar.
 *
 * AppStack applies `bottom` globally via the navigator's `contentStyle`; the
 * pre-navigator onboarding / auth screens use this hook directly:
 *   const ins = useScreenInsets();
 *   <View style={[styles.container, { paddingTop: ins.top, paddingBottom: ins.bottom }]}>
 */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  return {
    /** Replaces the old hard-coded `paddingTop: 56`/`64`. */
    top: Math.max(insets.top, spacing.md) + spacing.lg,
    /** Replaces the old `paddingBottom: spacing.xxl` — now also clears the nav bar. */
    bottom: insets.bottom + spacing.xxl,
    /** Raw insets, for callers composing their own spacing. */
    raw: insets,
  };
}
