import {
  ALL_AVATAR_OPTIONS,
  AVATAR_SHADES,
  BIRTH_MONTHS,
  avatarOptionsForMonth,
  buildAvatarOption,
  isValidAvatarId,
  parseAvatarId,
} from './avatars';

describe('BIRTH_MONTHS', () => {
  it('is exactly the 12 calendar months, 1-indexed and in order', () => {
    expect(BIRTH_MONTHS).toHaveLength(12);
    expect(BIRTH_MONTHS.map((m) => m.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(BIRTH_MONTHS[0].label).toBe('January');
    expect(BIRTH_MONTHS[11].label).toBe('December');
  });
});

describe('buildAvatarOption', () => {
  it('every month gets a distinct hue, evenly spaced round the wheel', () => {
    const hues = BIRTH_MONTHS.map((m) => buildAvatarOption(m.value, 'bold').colorFrom.match(/hsl\((\d+)/)![1]);
    expect(new Set(hues).size).toBe(12); // all 12 distinct
  });

  it('the 3 shades of the same month share a hue but differ in lightness', () => {
    const [soft, bold, dark] = AVATAR_SHADES.map((s) => buildAvatarOption(6, s.value));
    const hueOf = (c: string) => c.match(/hsl\((\d+)/)![1];
    expect(hueOf(soft.colorFrom)).toBe(hueOf(bold.colorFrom));
    expect(hueOf(bold.colorFrom)).toBe(hueOf(dark.colorFrom));
    expect(soft.colorFrom).not.toBe(bold.colorFrom);
    expect(bold.colorFrom).not.toBe(dark.colorFrom);
  });

  it('id round-trips through parseAvatarId', () => {
    const opt = buildAvatarOption(11, 'dark');
    expect(opt.id).toBe('11-dark');
    expect(parseAvatarId(opt.id)).toEqual(opt);
  });
});

describe('ALL_AVATAR_OPTIONS / avatarOptionsForMonth', () => {
  it('has 12 months × 3 shades = 36 unique ids', () => {
    expect(ALL_AVATAR_OPTIONS).toHaveLength(36);
    expect(new Set(ALL_AVATAR_OPTIONS.map((o) => o.id)).size).toBe(36);
  });

  it('a single month exposes exactly its 3 shades', () => {
    const opts = avatarOptionsForMonth(4);
    expect(opts).toHaveLength(3);
    expect(opts.every((o) => o.month === 4)).toBe(true);
    expect(opts.map((o) => o.shade).sort()).toEqual(['bold', 'dark', 'soft']);
  });
});

describe('parseAvatarId / isValidAvatarId', () => {
  it('accepts every id ALL_AVATAR_OPTIONS produces', () => {
    for (const opt of ALL_AVATAR_OPTIONS) {
      expect(isValidAvatarId(opt.id)).toBe(true);
    }
  });

  it('rejects an out-of-range month, an unknown shade, and garbage', () => {
    expect(isValidAvatarId('0-bold')).toBe(false);
    expect(isValidAvatarId('13-bold')).toBe(false);
    expect(isValidAvatarId('6-neon')).toBe(false);
    expect(isValidAvatarId('not-an-id')).toBe(false);
    expect(isValidAvatarId('')).toBe(false);
  });

  it('parseAvatarId returns null for the same invalid inputs, and null/undefined', () => {
    expect(parseAvatarId(null)).toBeNull();
    expect(parseAvatarId(undefined)).toBeNull();
    expect(parseAvatarId('13-bold')).toBeNull();
  });
});
