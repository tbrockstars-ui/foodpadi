import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { layout, spacing, type ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { useScreenInsets } from '../theme/useScreenInsets';

interface Props {
  children: React.ReactNode;
  /** Render a ScrollView instead of a plain View. */
  scroll?: boolean;
  /** Drop the safe-area top padding (e.g. a screen with its own hero image). */
  noTopInset?: boolean;
  /** Remove the default horizontal screen gutter (full-bleed content). */
  noPadding?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>;
}

/**
 * The standard page shell — one place for the screen background, the
 * consistent horizontal gutter (`layout.screenX`), and the safe-area top
 * padding. Replaces the `container: { flex: 1, backgroundColor, padding:
 * spacing.xl, paddingTop: 56 }` object that was copy-pasted into ~15
 * screens with slightly different `paddingTop` values. AppStack already adds
 * the bottom safe-area inset via the navigator's `contentStyle`, so this
 * only adds a comfortable bottom gap for scrolled content.
 */
export function Screen({
  children,
  scroll,
  noTopInset,
  noPadding,
  style,
  contentContainerStyle,
  scrollProps,
}: Props) {
  const { colors } = useTheme();
  const ins = useScreenInsets();
  const styles = makeStyles(colors);

  const pad: ViewStyle = {
    paddingTop: noTopInset ? 0 : ins.top,
    paddingHorizontal: noPadding ? 0 : layout.screenX,
  };

  if (scroll) {
    return (
      <ScrollView
        style={[styles.base, style]}
        contentContainerStyle={[pad, styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.base, pad, style]}>{children}</View>;
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    base: { flex: 1, backgroundColor: c.background },
    scrollContent: { paddingBottom: spacing.xxl },
  });
}
