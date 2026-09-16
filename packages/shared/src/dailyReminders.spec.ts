import {
  dayKindFor,
  scheduleForDate,
  genericReminderContent,
  planReminderContent,
  cookingReminderContent,
  shouldSuppressGenericReminder,
  type DailyReminderPreferencesView,
} from './dailyReminders';

const OFF_SLOT = { enabled: false, time: null };

function prefs(overrides: Partial<DailyReminderPreferencesView> = {}): DailyReminderPreferencesView {
  return {
    enabled: true,
    weekday: {
      breakfast: { enabled: true, time: '07:30' },
      lunch: { enabled: true, time: '13:00' },
      dinner: { enabled: true, time: '19:00' },
      coffee: { enabled: false, time: '10:30' },
    },
    weekend: {
      breakfast: { enabled: true, time: '09:00' },
      lunch: OFF_SLOT,
      dinner: { enabled: true, time: '19:30' },
      coffee: { enabled: true, time: '11:00' },
    },
    updatedAt: null,
    ...overrides,
  };
}

describe('dayKindFor', () => {
  it('treats Monday-Friday as weekday', () => {
    // 2026-09-07 is a Monday, 2026-09-11 is a Friday.
    expect(dayKindFor(new Date('2026-09-07T09:00:00'))).toBe('weekday');
    expect(dayKindFor(new Date('2026-09-11T09:00:00'))).toBe('weekday');
  });

  it('treats Saturday/Sunday as weekend', () => {
    // 2026-09-12 is a Saturday, 2026-09-13 is a Sunday.
    expect(dayKindFor(new Date('2026-09-12T09:00:00'))).toBe('weekend');
    expect(dayKindFor(new Date('2026-09-13T09:00:00'))).toBe('weekend');
  });
});

describe('scheduleForDate', () => {
  it('resolves the weekday schedule on a weekday', () => {
    const schedule = scheduleForDate(prefs(), new Date('2026-09-07T09:00:00'));
    expect(schedule.lunch).toEqual({ enabled: true, time: '13:00' });
  });

  it('resolves the weekend schedule on a weekend, independently configured', () => {
    const schedule = scheduleForDate(prefs(), new Date('2026-09-12T09:00:00'));
    expect(schedule.lunch).toEqual(OFF_SLOT);
    expect(schedule.dinner).toEqual({ enabled: true, time: '19:30' });
  });
});

describe('reminder content', () => {
  it('never names a dish in the generic reminder — offers a decision instead', () => {
    const lunch = genericReminderContent('lunch');
    expect(lunch.title).toBe('🍽️ Lunch time?');
    expect(lunch.actionLabel).toBe('What should I eat?');
    expect(lunch.deepLink).toBe('/cook-today');
  });

  it('coffee reminder opens FoodPadi generically, not a food decision', () => {
    const coffee = genericReminderContent('coffee');
    expect(coffee.actionLabel).toBe('Open FoodPadi');
  });

  it('a plan-covered slot names the actual planned recipe', () => {
    const content = planReminderContent('lunch', 'Chicken Fried Rice');
    expect(content.body).toContain('Chicken Fried Rice');
    expect(content.deepLink).toBe('/plan');
  });

  it('an active cooking journey points back at Continue Cooking', () => {
    const content = cookingReminderContent('Yam Porridge');
    expect(content.body).toContain('Yam Porridge');
    expect(content.actionLabel).toBe('Continue Cooking');
  });
});

describe('shouldSuppressGenericReminder', () => {
  it('suppresses when a plan item already covers this slot today', () => {
    expect(
      shouldSuppressGenericReminder('lunch', { planCoversSlotToday: true, hasActiveCookingJourney: false }),
    ).toBe(true);
  });

  it('suppresses a meal reminder when a cooking journey is already active', () => {
    expect(
      shouldSuppressGenericReminder('dinner', { planCoversSlotToday: false, hasActiveCookingJourney: true }),
    ).toBe(true);
  });

  it('never suppresses coffee just because a cooking journey is active', () => {
    expect(
      shouldSuppressGenericReminder('coffee', { planCoversSlotToday: false, hasActiveCookingJourney: true }),
    ).toBe(false);
  });

  it('does not suppress when nothing more specific is happening', () => {
    expect(
      shouldSuppressGenericReminder('breakfast', { planCoversSlotToday: false, hasActiveCookingJourney: false }),
    ).toBe(false);
  });
});
