export type ThemeScheme = 'default' | 'dark';

export const lightColors = {
  background: '#FBFAF7',
  surface: '#FFFFFF',
  surfaceSunken: '#F4F2EC',
  text: '#181C19',
  textMuted: '#6B7268',
  textFaint: '#9A9E94',
  primary: '#2F6B4F',
  primaryDark: '#204A37',
  primarySoft: '#EAF3EE',
  primaryText: '#FFFFFF',
  // "accent" is kept as an alias for existing call sites (Tag uses it);
  // "secondary" is the same colour, named per docs/FOODPADI_DESIGN_SYSTEM.md's
  // design-system table — new code should reach for `secondary`.
  accent: '#C2760C',
  accentSoft: '#FBF0DE',
  secondary: '#C2760C',
  secondarySoft: '#FBF0DE',
  success: '#3B7A3B',
  successSoft: '#EAF3EA',
  warning: '#B7791F',
  warningSoft: '#FBF1E2',
  border: '#E7E4DB',
  borderStrong: '#D4D0C4',
  danger: '#B3261E',
  dangerSoft: '#FBEBEA',
};

export type ThemeColors = typeof lightColors;

// Mirrors apps/web's :root[data-theme="dark"] token override — same intent,
// same hue shifts (green lightened for contrast on a dark surface).
export const darkColors: ThemeColors = {
  background: '#14171A',
  surface: '#1C2025',
  surfaceSunken: '#23282E',
  text: '#F2F1EC',
  textMuted: '#A7AEA9',
  textFaint: '#79807B',
  primary: '#5BBD8F',
  primaryDark: '#47A97B',
  primarySoft: '#1E3A2D',
  primaryText: '#0C1F17',
  accent: '#E0A24A',
  accentSoft: '#3A2C14',
  secondary: '#E0A24A',
  secondarySoft: '#3A2C14',
  success: '#5FAE5F',
  successSoft: '#1F331F',
  warning: '#D9A441',
  warningSoft: '#3A2F16',
  border: '#333A41',
  borderStrong: '#47505A',
  danger: '#E2685F',
  dangerSoft: '#3A1F1D',
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
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  subtitle: { fontSize: 15, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4 },
};
