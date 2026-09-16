import { DailyRemindersService } from './daily-reminders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

function build() {
  const rows = new Map<string, any>();
  const DEFAULTS = {
    enabled: true,
    weekdayBreakfastEnabled: false,
    weekdayBreakfastTime: null,
    weekdayLunchEnabled: false,
    weekdayLunchTime: null,
    weekdayDinnerEnabled: false,
    weekdayDinnerTime: null,
    weekdayCoffeeEnabled: false,
    weekdayCoffeeTime: null,
    weekendBreakfastEnabled: false,
    weekendBreakfastTime: null,
    weekendLunchEnabled: false,
    weekendLunchTime: null,
    weekendDinnerEnabled: false,
    weekendDinnerTime: null,
    weekendCoffeeEnabled: false,
    weekendCoffeeTime: null,
  };

  const prisma: any = {
    dailyReminderPreference: {
      upsert: jest.fn(({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const next = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { userId: where.userId, ...DEFAULTS, ...create, updatedAt: new Date() };
        rows.set(where.userId, next);
        return Promise.resolve(next);
      }),
    },
  };

  const analytics: any = { track: jest.fn().mockResolvedValue(undefined) };

  const service = new DailyRemindersService(
    prisma as unknown as PrismaService,
    analytics as unknown as AnalyticsService,
  );
  return { service, prisma, analytics, rows };
}

describe('DailyRemindersService', () => {
  it('creates a lazily-defaulted row (everything off) on first read', async () => {
    const { service } = build();
    const prefs = await service.getPreferences('u1');
    expect(prefs.enabled).toBe(true);
    expect(prefs.weekday.lunch).toEqual({ enabled: false, time: null });
    expect(prefs.weekend.coffee).toEqual({ enabled: false, time: null });
  });

  it('sets one slot without touching any other slot (§16 independence)', async () => {
    const { service } = build();
    await service.updatePreferences('u1', {
      weekday: { lunch: { enabled: true, time: '13:00' } },
    });
    const prefs = await service.updatePreferences('u1', {
      weekday: { coffee: { enabled: true, time: '10:30' } },
    });
    expect(prefs.weekday.lunch).toEqual({ enabled: true, time: '13:00' }); // untouched
    expect(prefs.weekday.coffee).toEqual({ enabled: true, time: '10:30' });
    expect(prefs.weekday.dinner).toEqual({ enabled: false, time: null }); // still off
  });

  it('weekday and weekend are independent schedules', async () => {
    const { service } = build();
    await service.updatePreferences('u1', {
      weekday: { lunch: { enabled: true, time: '13:00' } },
      weekend: { lunch: { enabled: true, time: '14:00' } },
    });
    const prefs = await service.getPreferences('u1');
    expect(prefs.weekday.lunch.time).toBe('13:00');
    expect(prefs.weekend.lunch.time).toBe('14:00');
  });

  it('global enabled:false pauses without clearing configured times (§17)', async () => {
    const { service } = build();
    await service.updatePreferences('u1', {
      weekday: { lunch: { enabled: true, time: '13:00' } },
    });
    const paused = await service.updatePreferences('u1', { enabled: false });
    expect(paused.enabled).toBe(false);
    expect(paused.weekday.lunch).toEqual({ enabled: true, time: '13:00' }); // preserved

    const resumed = await service.updatePreferences('u1', { enabled: true });
    expect(resumed.enabled).toBe(true);
    expect(resumed.weekday.lunch).toEqual({ enabled: true, time: '13:00' }); // restored exactly
  });

  it('changing a time from 13:00 to 13:30 leaves exactly one time stored, not both', async () => {
    const { service } = build();
    await service.updatePreferences('u1', {
      weekday: { lunch: { enabled: true, time: '13:00' } },
    });
    const updated = await service.updatePreferences('u1', {
      weekday: { lunch: { time: '13:30' } },
    });
    expect(updated.weekday.lunch).toEqual({ enabled: true, time: '13:30' });
  });

  it('two different users never see each other\'s schedule (§20)', async () => {
    const { service } = build();
    await service.updatePreferences('userA', {
      weekday: { lunch: { enabled: true, time: '13:00' } },
    });
    await service.updatePreferences('userB', {
      weekday: { lunch: { enabled: true, time: '12:00' } },
    });
    const a = await service.getPreferences('userA');
    const b = await service.getPreferences('userB');
    expect(a.weekday.lunch.time).toBe('13:00');
    expect(b.weekday.lunch.time).toBe('12:00');
  });

  it('tracks daily_reminder_enabled / disabled / reminder_time_changed', async () => {
    const { service, analytics } = build();
    await service.updatePreferences('u1', {
      weekday: { lunch: { enabled: true, time: '13:00' } },
    });
    expect(analytics.track).toHaveBeenCalledWith(
      'daily_reminder_enabled',
      { userId: 'u1' },
      { mealType: 'lunch', dayKind: 'weekday' },
    );

    analytics.track.mockClear();
    await service.updatePreferences('u1', { weekday: { lunch: { time: '13:30' } } });
    expect(analytics.track).toHaveBeenCalledWith(
      'reminder_time_changed',
      { userId: 'u1' },
      { mealType: 'lunch', dayKind: 'weekday' },
    );

    analytics.track.mockClear();
    await service.updatePreferences('u1', { weekday: { lunch: { enabled: false } } });
    expect(analytics.track).toHaveBeenCalledWith(
      'daily_reminder_disabled',
      { userId: 'u1' },
      { mealType: 'lunch', dayKind: 'weekday' },
    );
  });

  it('tracks daily_reminders_setup only when source is "onboarding"', async () => {
    const { service, analytics } = build();
    await service.updatePreferences('u1', {
      weekday: { lunch: { enabled: true, time: '13:00' } },
      source: 'onboarding',
    });
    expect(analytics.track).toHaveBeenCalledWith('daily_reminders_setup', { userId: 'u1' });

    analytics.track.mockClear();
    await service.updatePreferences('u1', { weekday: { dinner: { enabled: true, time: '19:00' } } });
    expect(analytics.track).not.toHaveBeenCalledWith('daily_reminders_setup', expect.anything());
  });
});
