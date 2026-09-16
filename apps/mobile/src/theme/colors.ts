export type ThemeScheme = 'default' | 'dark';

// FoodPadi design tokens — mirrors apps/web/app/globals.css exactly so web and
// mobile stay one visual identity. Structure = charcoal/cream neutrals;
// `primary` (lime) = action + intelligence, used sparingly; `secondary`
// (amber) = food warmth / highlights. `primary` is a FILL colour (dark text
// on top); `primaryInk` is the legible-on-page accent for text / icons.
export const lightColors = {
  background: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#F1F1EC',
  text: '#171A16',
  textMuted: '#626860',
  textFaint: '#9BA097',
  primary: '#9ACD32',
  primaryDark: '#86B92A',
  primarySoft: '#EEF6DB',
  primaryText: '#1C2E00',
  primaryInk: '#4F7D12',
  // "accent" / "accentSoft" kept as aliases for existing call sites (Tag);
  // new code should reach for `secondary`.
  accent: '#D98B00',
  accentSoft: '#FBEED7',
  secondary: '#D98B00',
  secondaryDark: '#BD7900',
  secondarySoft: '#FBEED7',
  secondaryText: '#3A2500',
  success: '#3E9B57',
  successSoft: '#E8F3EA',
  warning: '#C68A1E',
  warningSoft: '#FBF1E0',
  border: '#DDE2D8',
  borderStrong: '#C7CDBF',
  danger: '#C4362B',
  dangerSoft: '#FBECEB',
};

export type ThemeColors = typeof lightColors;

// Deep near-black green ground (not pure black); lime "glows" through
// contrast without going neon. Designed for dark, not inverted from light.
export const darkColors: ThemeColors = {
  background: '#080A08',
  surface: '#141814',
  surfaceElevated: '#1A1F19',
  surfaceSunken: '#0E110E',
  text: '#F7F7F2',
  textMuted: '#B8BDB5',
  textFaint: '#7E847B',
  primary: '#C8F34A',
  primaryDark: '#B4E236',
  primarySoft: '#1D2A10',
  primaryText: '#0C1A00',
  primaryInk: '#C8F34A',
  accent: '#FFB52E',
  accentSoft: '#2E2410',
  secondary: '#FFB52E',
  secondaryDark: '#EAA11C',
  secondarySoft: '#2E2410',
  secondaryText: '#1C1300',
  success: '#63C77F',
  successSoft: '#142718',
  warning: '#E7A93C',
  warningSoft: '#2C2210',
  border: '#343A32',
  borderStrong: '#48503F',
  danger: '#F0685E',
  dangerSoft: '#2E1614',
};

export function colorsFor(scheme: ThemeScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

// Back-compat only — every screen/component has since migrated to
// useTheme() so it responds to the black/white setting. Nothing imports
// this directly any more; kept as a static light-palette fallback for any
// future code that hasn't wired up useTheme() yet.
export const colors = lightColors;

// A small, consistent spacing scale — every screen should reach for these
// rather than one-off pixel values, so rhythm stays consistent as more
// screens get built.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  // Added in the declutter pass — the gap between major page sections, so
  // whitespace between groups reads as deliberate rhythm rather than a
  // random assortment of one-off margins.
  xxxl: 48,
};

// Shared page-layout constants — introduced with the <Screen>/<ScreenHeader>
// primitives so every screen indents its content by the same amount and a
// tablet/wide viewport doesn't stretch text to an unreadable measure.
export const layout = {
  screenX: spacing.xl,
  sectionGap: spacing.xl,
  maxContentWidth: 560,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

// Soft, low-contrast elevation — both the iOS shadow* props and Android's
// elevation are set; each platform simply ignores the props it doesn't use.
export const shadow = {
  card: {
    shadowColor: '#14150F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  raised: {
    shadowColor: '#14150F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
};

export const typography = {
  // lineHeight added in the declutter pass so long titles (recipe / food
  // names) wrap onto a second line with comfortable leading instead of
  // cramped default spacing. Values/weights are unchanged.
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 34 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 26 },
  // A confident, full-size section header (Settings already hand-rolled this
  // — now a shared token). Use for grouped-navigation section titles.
  heading: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 28 },
  subtitle: { fontSize: 15, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4 },
  // Small all-caps eyebrow above a group of content. Distinct from `label`
  // (used inline) — this one is always a standalone section marker.
  overline: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6 },
};
