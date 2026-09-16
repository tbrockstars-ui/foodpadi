import { PlanAheadService } from './plan-ahead.service';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementService } from '../billing/entitlement.service';
import { CookingInsightsService } from '../feedback/cooking-insights.service';

// Same lightweight constructor-mock pattern as
// create-standalone-shopping-list.spec.ts — covers only the new
// reminderOffsetMinutes wiring on updateItem; the pre-existing
// mealChoice/plannedTime behaviour is unchanged and was already implicitly
// exercised elsewhere.
describe('PlanAheadService.updateItem — reminderOffsetMinutes', () => {
  let prisma: {
    mealPlan: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    mealPlanItem: { update: jest.Mock };
  };
  let analytics: { track: jest.Mock };
  let service: PlanAheadService;

  const ownedPlanRow = {
    id: 'plan-1',
    userId: 'u-1',
    deletedAt: null,
    items: [{ id: 'item-1' }],
    shoppingLists: [],
  };

  beforeEach(() => {
    prisma = {
      mealPlan: {
        findUnique: jest.fn().mockResolvedValue(ownedPlanRow),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...ownedPlanRow, shoppingLists: [] }),
      },
      mealPlanItem: { update: jest.fn().mockResolvedValue(undefined) },
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

  it('writes an explicit reminderOffsetMinutes override', async () => {
    await service.updateItem('plan-1', 'item-1', 'u-1', { reminderOffsetMinutes: 45 });

    expect(prisma.mealPlanItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { reminderOffsetMinutes: 45 },
    });
  });

  it('writes 0 as a real override ("no reminder for this day"), not as "omit"', async () => {
    await service.updateItem('plan-1', 'item-1', 'u-1', { reminderOffsetMinutes: 0 });

    expect(prisma.mealPlanItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { reminderOffsetMinutes: 0 },
    });
  });

  it('clears the override (back to inheriting the plan default) when sent null', async () => {
    await service.updateItem('plan-1', 'item-1', 'u-1', { reminderOffsetMinutes: null });

    expect(prisma.mealPlanItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { reminderOffsetMinutes: null },
    });
  });

  it('omits the field entirely when not provided, leaving any existing override untouched', async () => {
    await service.updateItem('plan-1', 'item-1', 'u-1', { mealChoice: 'eat_out' });

    expect(prisma.mealPlanItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { mealChoice: 'eat_out' },
    });
  });
});
