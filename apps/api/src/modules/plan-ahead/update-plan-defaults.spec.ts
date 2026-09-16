import { PlanAheadService } from './plan-ahead.service';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementService } from '../billing/entitlement.service';
import { CookingInsightsService } from '../feedback/cooking-insights.service';

// Same lightweight constructor-mock pattern as
// create-standalone-shopping-list.spec.ts.
describe('PlanAheadService.updatePlanDefaults', () => {
  let prisma: {
    mealPlan: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
  };
  let analytics: { track: jest.Mock };
  let service: PlanAheadService;

  const ownedPlanRow = { id: 'plan-1', userId: 'u-1', deletedAt: null, items: [], shoppingLists: [] };

  beforeEach(() => {
    prisma = {
      mealPlan: {
        findUnique: jest.fn().mockResolvedValue(ownedPlanRow),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...ownedPlanRow, shoppingLists: [] }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    analytics = { track: jest.fn() };
    service = new PlanAheadService(
      {} as unknown as ClaudeService,
      prisma as unknown as PrismaService,
      analytics as unknown as AnalyticsService,
      {} as unknown as AiAccessService,
      {} as unknown as EntitlementService,
      {} as unknown as CookingInsightsService,
    );
  });

  it('rejects a plan the user does not own', async () => {
    prisma.mealPlan.findUnique.mockResolvedValueOnce({ ...ownedPlanRow, userId: 'someone-else' });
    await expect(service.updatePlanDefaults('plan-1', 'u-1', { defaultMealTime: '19:00' })).rejects.toThrow();
  });

  it('writes only the fields provided', async () => {
    await service.updatePlanDefaults('plan-1', 'u-1', { defaultMealTime: '19:00' });

    expect(prisma.mealPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { defaultMealTime: '19:00' },
    });
  });

  it('writes both fields when both are provided', async () => {
    await service.updatePlanDefaults('plan-1', 'u-1', { defaultMealTime: '18:30', defaultReminderOffsetMinutes: 45 });

    expect(prisma.mealPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { defaultMealTime: '18:30', defaultReminderOffsetMinutes: 45 },
    });
  });

  it('clears the default time when explicitly sent null', async () => {
    await service.updatePlanDefaults('plan-1', 'u-1', { defaultMealTime: null });

    expect(prisma.mealPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { defaultMealTime: null },
    });
  });

  it('writes nothing when neither field is provided', async () => {
    await service.updatePlanDefaults('plan-1', 'u-1', {});

    expect(prisma.mealPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: {} });
  });

  it('tracks a plan_ahead_defaults_updated analytics event', async () => {
    await service.updatePlanDefaults('plan-1', 'u-1', { defaultMealTime: '19:00', defaultReminderOffsetMinutes: 30 });

    expect(analytics.track).toHaveBeenCalledWith(
      'plan_ahead_defaults_updated',
      { userId: 'u-1' },
      expect.objectContaining({ planId: 'plan-1', hasDefaultTime: true, defaultReminderOffsetMinutes: 30 }),
    );
  });
});
