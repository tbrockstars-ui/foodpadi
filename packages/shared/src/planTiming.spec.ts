import {
  effectivePlannedTime,
  effectiveReminderOffsetMinutes,
  reminderShortfallMinutes,
  suggestedStartTime,
} from './planTiming';

describe('effectivePlannedTime', () => {
  it('uses the item\'s own plannedTime when set, ignoring the plan default', () => {
    expect(
      effectivePlannedTime(
        { plannedTime: '20:00', reminderOffsetMinutes: null },
        { defaultMealTime: '19:00', defaultReminderOffsetMinutes: 30 },
      ),
    ).toBe('20:00');
  });

  it('falls back to the plan default when the item has no plannedTime', () => {
    expect(
      effectivePlannedTime(
        { plannedTime: null, reminderOffsetMinutes: null },
        { defaultMealTime: '19:00', defaultReminderOffsetMinutes: 30 },
      ),
    ).toBe('19:00');
  });

  it('returns null when neither the item nor the plan has a time', () => {
    expect(
      effectivePlannedTime(
        { plannedTime: null, reminderOffsetMinutes: null },
        { defaultMealTime: null, defaultReminderOffsetMinutes: 30 },
      ),
    ).toBeNull();
  });

  it('changing the plan default does not affect a day with its own override', () => {
    const overriddenDay = { plannedTime: '20:00', reminderOffsetMinutes: null };
    const before = effectivePlannedTime(overriddenDay, { defaultMealTime: '19:00', defaultReminderOffsetMinutes: 30 });
    const after = effectivePlannedTime(overriddenDay, { defaultMealTime: '18:30', defaultReminderOffsetMinutes: 30 });
    expect(before).toBe('20:00');
    expect(after).toBe('20:00'); // unchanged — the override still wins
  });

  it('changing the plan default DOES propagate to a day with no override', () => {
    const plainDay = { plannedTime: null, reminderOffsetMinutes: null };
    const before = effectivePlannedTime(plainDay, { defaultMealTime: '19:00', defaultReminderOffsetMinutes: 30 });
    const after = effectivePlannedTime(plainDay, { defaultMealTime: '18:30', defaultReminderOffsetMinutes: 30 });
    expect(before).toBe('19:00');
    expect(after).toBe('18:30'); // changed — this day was inheriting the default
  });
});

describe('effectiveReminderOffsetMinutes', () => {
  it("uses the item's own override when set, including 0 (\"no reminder\")", () => {
    expect(
      effectiveReminderOffsetMinutes(
        { plannedTime: null, reminderOffsetMinutes: 45 },
        { defaultMealTime: null, defaultReminderOffsetMinutes: 30 },
      ),
    ).toBe(45);
    expect(
      effectiveReminderOffsetMinutes(
        { plannedTime: null, reminderOffsetMinutes: 0 },
        { defaultMealTime: null, defaultReminderOffsetMinutes: 30 },
      ),
    ).toBe(0);
  });

  it('falls back to the plan default when the item has no override (null, not 0)', () => {
    expect(
      effectiveReminderOffsetMinutes(
        { plannedTime: null, reminderOffsetMinutes: null },
        { defaultMealTime: null, defaultReminderOffsetMinutes: 30 },
      ),
    ).toBe(30);
  });
});

describe('suggestedStartTime', () => {
  it('subtracts the recipe\'s total time from the eating time', () => {
    expect(suggestedStartTime('19:00', 35)).toBe('18:25');
  });

  it('handles a recipe under an hour with no rounding surprises', () => {
    expect(suggestedStartTime('18:00', 15)).toBe('17:45');
  });

  it('wraps back across midnight for a very early eating time', () => {
    expect(suggestedStartTime('00:10', 30)).toBe('23:40');
  });

  it('wraps for a recipe longer than the time until midnight', () => {
    expect(suggestedStartTime('01:00', 90)).toBe('23:30');
  });

  it('returns the eating time itself for a zero-length recipe', () => {
    expect(suggestedStartTime('19:00', 0)).toBe('19:00');
  });
});

describe('reminderShortfallMinutes', () => {
  it('is 0 when the reminder gives at least as much notice as the recipe needs', () => {
    expect(reminderShortfallMinutes(30, 25)).toBe(0);
    expect(reminderShortfallMinutes(30, 30)).toBe(0);
  });

  it('is the exact gap when the recipe takes longer than the reminder', () => {
    expect(reminderShortfallMinutes(30, 35)).toBe(5);
    expect(reminderShortfallMinutes(10, 45)).toBe(35);
  });

  it('is 0 when there is no reminder configured at all — nothing to fall short of', () => {
    expect(reminderShortfallMinutes(0, 90)).toBe(0);
  });
});
