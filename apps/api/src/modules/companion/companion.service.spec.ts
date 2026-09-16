import { CompanionService } from './companion.service';
import { ContextService, type FoodContext } from './context.service';
import { PatternService } from './pattern.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementService } from '../billing/entitlement.service';

// FoodPadi Memory is Paid-only — default the entitlement stub to 'paid' so the
// existing suggestion behaviour is exercised; individual tests can override.
const entitlementsStub = { getUserEntitlement: jest.fn().mockResolvedValue('paid') };
beforeEach(() => entitlementsStub.getUserEntitlement.mockResolvedValue('paid'));

function emptyContext(overrides: Partial<FoodContext> = {}): FoodContext {
  return {
    now: new Date('2026-02-06T17:45:00'), // a Friday, 17:45
    dayOfWeek: 5,
    weekdayKey: 'friday',
    weekdayGroup: 'weekday',
    decidedToday: false,
    todayPlanItems: [],
    upcomingPlanItem: null,
    pantryItemNames: [],
    favouriteCuisines: [],
    avoidedIngredients: [],
    activeGoalTypes: [],
    patterns: [],
    ...overrides,
  };
}

function fakePattern(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    userId: 'u1',
    patternType: 'meal_time',
    patternKey: 'weekday_dinner',
    patternValue: '18:00',
    confidence: 0.72,
    evidenceCount: 8,
    firstObservedAt: new Date('2026-01-01'),
    lastObservedAt: new Date('2026-02-05'),
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-05'),
    ...overrides,
  } as any;
}

const DEFAULT_PREFS = {
  userId: 'u1',
  enabled: true,
  notificationsEnabled: true,
  mutedTypes: [] as string[],
  maxDailySuggestions: 1,
  maxWeeklySuggestions: 3,
  updatedAt: new Date(),
};

describe('CompanionService.getSuggestion', () => {
  let prisma: any;
  let contextService: { buildContext: jest.Mock };
  let patternService: { recompute: jest.Mock; resetForUser: jest.Mock };
  let analytics: { track: jest.Mock };
  let service: CompanionService;

  beforeEach(() => {
    prisma = {
      companionPreference: { upsert: jest.fn().mockResolvedValue({ ...DEFAULT_PREFS }) },
      companionSuggestion: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sug-1', ...data })),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    contextService = { buildContext: jest.fn().mockResolvedValue(emptyContext()) };
    patternService = { recompute: jest.fn().mockResolvedValue(undefined), resetForUser: jest.fn().mockResolvedValue(undefined) };
    analytics = { track: jest.fn() };

    service = new CompanionService(
      prisma as unknown as PrismaService,
      contextService as unknown as ContextService,
      patternService as unknown as PatternService,
      analytics as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );
  });

  it('a brand-new user with no history gets no suggestion — never a generic filler', async () => {
    const result = await service.getSuggestion('u1');
    expect(result).toBeNull();
    expect(prisma.companionSuggestion.create).not.toHaveBeenCalled();
  });

  it('Companion disabled means no suggestion, ever', async () => {
    prisma.companionPreference.upsert.mockResolvedValue({ ...DEFAULT_PREFS, enabled: false });
    contextService.buildContext.mockResolvedValue(emptyContext({ patterns: [fakePattern()] }));
    const result = await service.getSuggestion('u1');
    expect(result).toBeNull();
  });

  it('FoodPadi Memory is Paid-only — a trial user gets no suggestion and no pattern recompute', async () => {
    entitlementsStub.getUserEntitlement.mockResolvedValue('trial');
    contextService.buildContext.mockResolvedValue(emptyContext({ patterns: [fakePattern()] }));
    const result = await service.getSuggestion('u1');
    expect(result).toBeNull();
    expect(patternService.recompute).not.toHaveBeenCalled();
    expect(prisma.companionSuggestion.create).not.toHaveBeenCalled();
  });

  it('respects the daily cap', async () => {
    prisma.companionSuggestion.count.mockResolvedValueOnce(1); // dayCount >= max (1)
    contextService.buildContext.mockResolvedValue(emptyContext({ patterns: [fakePattern()] }));
    expect(await service.getSuggestion('u1')).toBeNull();
  });

  it('respects the weekly cap', async () => {
    prisma.companionSuggestion.count
      .mockResolvedValueOnce(0) // day
      .mockResolvedValueOnce(3); // week >= max (3)
    contextService.buildContext.mockResolvedValue(emptyContext({ patterns: [fakePattern()] }));
    expect(await service.getSuggestion('u1')).toBeNull();
  });

  it('never sends two suggestions close together', async () => {
    prisma.companionSuggestion.findFirst.mockResolvedValue({ deliveredAt: new Date(Date.now() - 60 * 60_000) }); // 1h ago
    contextService.buildContext.mockResolvedValue(emptyContext({ patterns: [fakePattern()] }));
    expect(await service.getSuggestion('u1')).toBeNull();
  });

  it('produces a usual_time suggestion from a matching meal_time pattern', async () => {
    const ctx = emptyContext({ patterns: [fakePattern({ confidence: 0.65 })] }); // now is 17:45, pattern is 18:00 -> within 60 min
    contextService.buildContext.mockResolvedValue(ctx);
    const result = await service.getSuggestion('u1');
    expect(result).toMatchObject({ type: 'usual_time', ctaTarget: 'decide', ctaLabel: 'Help me decide' });
    expect(result!.reason).toMatch(/usually decide/i);
    expect(prisma.companionSuggestion.create).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith(
      'companion_suggestion_shown',
      { userId: 'u1' },
      expect.objectContaining({ suggestionType: 'usual_time' }),
    );
  });

  it('does not suggest usual_time when the pattern time is outside the tolerance window', async () => {
    const ctx = emptyContext({ patterns: [fakePattern({ patternValue: '08:00' })] }); // now is 17:45
    contextService.buildContext.mockResolvedValue(ctx);
    expect(await service.getSuggestion('u1')).toBeNull();
  });

  it('suggests using pantry ingredients when there are enough of them', async () => {
    const ctx = emptyContext({ pantryItemNames: ['rice', 'chicken', 'onion', 'pepper'] });
    contextService.buildContext.mockResolvedValue(ctx);
    const result = await service.getSuggestion('u1');
    expect(result).toMatchObject({ type: 'use_what_you_have', ctaTarget: 'cook' });
    expect(result!.ctaPayload?.initialIngredients).toEqual(['rice', 'chicken', 'onion', 'pepper']);
  });

  it('does not suggest pantry use with too few items', async () => {
    const ctx = emptyContext({ pantryItemNames: ['rice'] });
    contextService.buildContext.mockResolvedValue(ctx);
    expect(await service.getSuggestion('u1')).toBeNull();
  });

  it('plan_support wins over a same-strength usual_time candidate — a committed plan outranks a guess', async () => {
    const ctx = emptyContext({
      patterns: [fakePattern()],
      todayPlanItems: [{ id: 'i1', mealPlanId: 'mp1', recipeTitle: 'Jollof Rice', mealChoice: 'cook', plannedTime: '18:00', minutesUntil: 15 }],
      upcomingPlanItem: { id: 'i1', mealPlanId: 'mp1', recipeTitle: 'Jollof Rice', mealChoice: 'cook', plannedTime: '18:00', minutesUntil: 15 },
    });
    contextService.buildContext.mockResolvedValue(ctx);
    const result = await service.getSuggestion('u1');
    expect(result?.type).toBe('plan_support');
    expect(result?.ctaTarget).toBe('cook');
  });

  it('an eat-out upcoming plan item points at the plan, not a recipe', async () => {
    const ctx = emptyContext({
      upcomingPlanItem: { id: 'i1', mealPlanId: 'mp1', recipeTitle: null, mealChoice: 'eat_out', plannedTime: '19:00', minutesUntil: 20 },
    });
    contextService.buildContext.mockResolvedValue(ctx);
    const result = await service.getSuggestion('u1');
    expect(result).toMatchObject({ type: 'plan_support', ctaTarget: 'plan', ctaLabel: 'View plan' });
  });

  it('a routine suggestion is suppressed after repeated negative feedback on that type', async () => {
    prisma.companionSuggestion.groupBy.mockResolvedValue([{ suggestionType: 'routine', _count: { _all: 2 } }]);
    const ctx = emptyContext({
      patterns: [fakePattern({ patternType: 'day_routine', patternKey: 'friday', patternValue: 'eat_out', confidence: 0.8 })],
    });
    contextService.buildContext.mockResolvedValue(ctx);
    expect(await service.getSuggestion('u1')).toBeNull();
  });

  it('a muted suggestion type never comes back', async () => {
    prisma.companionPreference.upsert.mockResolvedValue({ ...DEFAULT_PREFS, mutedTypes: ['routine'] });
    const ctx = emptyContext({
      patterns: [fakePattern({ patternType: 'day_routine', patternKey: 'friday', patternValue: 'eat_out', confidence: 0.8 })],
    });
    contextService.buildContext.mockResolvedValue(ctx);
    expect(await service.getSuggestion('u1')).toBeNull();
  });

  it('a pattern type the engine does not map to a suggestion produces no candidate', async () => {
    const ctx = emptyContext({
      patterns: [fakePattern({ patternType: 'cuisine_frequency', patternKey: 'nigerian', patternValue: 'Nigerian' })],
    });
    contextService.buildContext.mockResolvedValue(ctx);
    expect(await service.getSuggestion('u1')).toBeNull();
  });
});

describe('CompanionService.recordAction', () => {
  it('"do not remind" adds the suggestion type to mutedTypes', async () => {
    const prisma: any = {
      companionSuggestion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sug-1', userId: 'u1', suggestionType: 'routine', openedAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      companionPreference: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const analytics = { track: jest.fn() };
    const service = new CompanionService(
      prisma,
      {} as unknown as ContextService,
      {} as unknown as PatternService,
      analytics as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );

    await service.recordAction('u1', 'sug-1', 'do_not_remind');

    expect(prisma.companionPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        update: { mutedTypes: { push: 'routine' } },
      }),
    );
    expect(analytics.track).toHaveBeenCalledWith('companion_suggestion_do_not_remind', { userId: 'u1' }, expect.anything());
  });

  it('sets openedAt the first time a suggestion is opened', async () => {
    const prisma: any = {
      companionSuggestion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sug-1', userId: 'u1', suggestionType: 'usual_time', openedAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const analytics = { track: jest.fn() };
    const service = new CompanionService(
      prisma,
      {} as unknown as ContextService,
      {} as unknown as PatternService,
      analytics as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );

    await service.recordAction('u1', 'sug-1', 'opened');

    expect(prisma.companionSuggestion.update).toHaveBeenCalledWith({
      where: { id: 'sug-1' },
      data: expect.objectContaining({ action: 'opened', openedAt: expect.any(Date) }),
    });
  });

  it('does not overwrite an existing openedAt', async () => {
    const prisma: any = {
      companionSuggestion: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'sug-1', userId: 'u1', suggestionType: 'usual_time', openedAt: new Date('2026-01-01') }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const analytics = { track: jest.fn() };
    const service = new CompanionService(
      prisma,
      {} as unknown as ContextService,
      {} as unknown as PatternService,
      analytics as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );

    await service.recordAction('u1', 'sug-1', 'opened');

    const data = prisma.companionSuggestion.update.mock.calls[0][0].data;
    expect(data.openedAt).toBeUndefined();
  });

  it("ignores an action on a suggestion that is not the caller's", async () => {
    const prisma: any = {
      companionSuggestion: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const analytics = { track: jest.fn() };
    const service = new CompanionService(
      prisma,
      {} as unknown as ContextService,
      {} as unknown as PatternService,
      analytics as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );
    await service.recordAction('someone-else', 'sug-1', 'accepted');
    expect(prisma.companionSuggestion.update).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });
});

describe('CompanionService.resetMemory', () => {
  it('clears both learned patterns and suggestion history', async () => {
    const prisma: any = {
      companionSuggestion: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const patterns = { resetForUser: jest.fn().mockResolvedValue(undefined) };
    const service = new CompanionService(
      prisma,
      {} as unknown as ContextService,
      patterns as unknown as PatternService,
      {} as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );

    await service.resetMemory('u1');

    expect(patterns.resetForUser).toHaveBeenCalledWith('u1');
    expect(prisma.companionSuggestion.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});

describe('CompanionService preferences', () => {
  it('lazily creates a default preference row on first read', async () => {
    const prisma: any = {
      companionPreference: {
        upsert: jest.fn().mockResolvedValue({ enabled: true, notificationsEnabled: true, mutedTypes: [] }),
      },
    };
    const service = new CompanionService(
      prisma,
      {} as unknown as ContextService,
      {} as unknown as PatternService,
      {} as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );

    const prefs = await service.getPreferences('u1');

    expect(prisma.companionPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    expect(prefs).toEqual({ enabled: true, notificationsEnabled: true, mutedTypes: [] });
  });

  it('updates only the fields that were provided', async () => {
    const prisma: any = {
      companionPreference: {
        upsert: jest.fn().mockResolvedValue({ enabled: true, notificationsEnabled: false, mutedTypes: [] }),
      },
    };
    const service = new CompanionService(
      prisma,
      {} as unknown as ContextService,
      {} as unknown as PatternService,
      {} as unknown as AnalyticsService,
      entitlementsStub as unknown as EntitlementService,
    );

    await service.updatePreferences('u1', { notificationsEnabled: false });

    expect(prisma.companionPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { notificationsEnabled: false } }),
    );
  });
});
