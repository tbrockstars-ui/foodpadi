// Birth-month avatar picker (user instruction 2026-09-11) — "beautiful icons
// that represent their birth month". Deliberately asset-free and deterministic
// (no images to host, nothing that can 404): one emoji per calendar month,
// offered in 3 colour shades. Colours are generated, not hand-picked, by
// spacing hues evenly round the colour wheel (12 months × 30° = 360°) so the
// full set is visually coherent and every month gets a genuinely distinct
// identity — the same technique a "month wheel" calendar graphic would use.
//
// Both web (CSS gradients) and mobile (flat RN View fills, no SVG/gradient
// library in that app) render from this one source of truth, via `colorFrom`/
// `colorTo` — mobile just uses `colorFrom`.

export interface BirthMonthOption {
  value: number; // 1-12
  label: string;
}

export const BIRTH_MONTHS: BirthMonthOption[] = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// One emblem per month — a mix of birth-flower tradition (Feb violet → tulip
// is closer in spirit, Apr daisy, Jun rose, Oct marigold, Nov chrysanthemum…)
// and FoodPadi-flavoured seasonal picks (Jul watermelon, Sep grapes) where no
// widely-supported flower emoji exists for the traditional choice.
const MONTH_EMOJI: Record<number, string> = {
  1: '❄️',
  2: '🌷',
  3: '🌼',
  4: '🌸',
  5: '🌻',
  6: '🌹',
  7: '🍉',
  8: '🌺',
  9: '🍇',
  10: '🍁',
  11: '🌰',
  12: '⭐',
};

export type AvatarShade = 'soft' | 'bold' | 'dark';

export const AVATAR_SHADES: { value: AvatarShade; label: string }[] = [
  { value: 'soft', label: 'Soft' },
  { value: 'bold', label: 'Bold' },
  { value: 'dark', label: 'Midnight' },
];

// [saturation%, lightness-from%, lightness-to%] per shade, applied to every
// month's hue so all 36 options share one consistent "feel" per shade tier.
const SHADE_TUNING: Record<AvatarShade, [number, number, number]> = {
  soft: [65, 90, 76],
  bold: [72, 58, 42],
  dark: [48, 24, 12],
};

export interface AvatarOption {
  /** "<month>-<shade>", e.g. "6-bold". The only thing persisted server-side. */
  id: string;
  month: number;
  shade: AvatarShade;
  emoji: string;
  monthLabel: string;
  shadeLabel: string;
  /** CSS/RN colour strings — web can gradient colorFrom→colorTo, mobile (no
      gradient lib) just fills with colorFrom. */
  colorFrom: string;
  colorTo: string;
  /** A legible colour for the emoji/initials drawn on top of this fill. */
  textColor: string;
}

function hueForMonth(month: number): number {
  return ((month - 1) * 30) % 360;
}

export function buildAvatarOption(month: number, shade: AvatarShade): AvatarOption {
  const hue = hueForMonth(month);
  const [s, l1, l2] = SHADE_TUNING[shade];
  const monthLabel = BIRTH_MONTHS[month - 1]?.label ?? 'Unknown';
  const shadeLabel = AVATAR_SHADES.find((x) => x.value === shade)?.label ?? shade;
  return {
    id: `${month}-${shade}`,
    month,
    shade,
    emoji: MONTH_EMOJI[month] ?? '⭐',
    monthLabel,
    shadeLabel,
    colorFrom: `hsl(${hue}, ${s}%, ${l1}%)`,
    colorTo: `hsl(${hue}, ${s}%, ${l2}%)`,
    textColor: shade === 'soft' ? `hsl(${hue}, 55%, 20%)` : '#ffffff',
  };
}

/** All 36 options (12 months × 3 shades) — handy for a full picker grid. */
export const ALL_AVATAR_OPTIONS: AvatarOption[] = BIRTH_MONTHS.flatMap((m) =>
  AVATAR_SHADES.map((s) => buildAvatarOption(m.value, s.value)),
);

/** Just the 3 shade options for one month — what the picker shows once a
    month is chosen. */
export function avatarOptionsForMonth(month: number): AvatarOption[] {
  return AVATAR_SHADES.map((s) => buildAvatarOption(month, s.value));
}

export function parseAvatarId(id: string | null | undefined): AvatarOption | null {
  if (!id) return null;
  const [monthStr, shade] = id.split('-');
  const month = Number(monthStr);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (shade !== 'soft' && shade !== 'bold' && shade !== 'dark') return null;
  return buildAvatarOption(month, shade);
}

export function isValidAvatarId(id: string): boolean {
  return parseAvatarId(id) !== null;
}
