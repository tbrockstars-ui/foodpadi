import { PlanAheadService } from './plan-ahead.service';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementService } from '../billing/entitlement.service';
import { CookingInsightsService } from '../feedback/cooking-insights.service';

// Ticking a linked Cooking Journey's shopping list to/from complete should
// move that journey between the "shopping" and "ready_to_cook" stages, so the
// Cook landing card and the shopping screen agree without an extra client
// call (docs cooking-journey brief §9/§26). A list with no journey, or a
// finished journey, is left alone.
describe('PlanAheadService.updateShoppingListItem — Cooking Journey stage sync', () => {
  let prisma: any;
  let analytics: { track: jest.Mock };
  let service: PlanAheadService;

  beforeEach(() => {
    prisma = {
      shoppingList: { findUnique: jest.fn() },
      shoppingListItem: { update: jest.fn().mockResolvedValue({ id: 'i-1', checked: true }), findMany: jest.fn() },
      cookingJourney: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
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

  const ownedList = () => ({ id: 'list-1', userId: 'u-1', status: 'open', mealPlanId: null, items: [], cookingJourney: null });

  it('promotes a shopping journey to ready_to_cook once the last item is checked', async () => {
    prisma.shoppingList.findUnique.mockResolvedValue(ownedList());
    prisma.cookingJourney.findUnique.mockResolvedValue({ id: 'j-1', stage: 'shopping', status: 'active' });
    prisma.shoppingListItem.findMany.mockResolvedValue([{ checked: true }, { checked: true }]);

    await service.updateShoppingListItem('list-1', 'i-1', 'u-1', { checked: true });

    expect(prisma.cookingJourney.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'j-1' }, data: expect.objectContaining({ stage: 'ready_to_cook' }) }),
    );
    expect(analytics.track).toHaveBeenCalledWith(
      'shopping_completed',
      { userId: 'u-1' },
      expect.objectContaining({ to: 'ready_to_cook' }),
    );
  });

  it('drops a ready_to_cook journey back to shopping when an item is un-checked', async () => {
    prisma.shoppingList.findUnique.mockResolvedValue(ownedList());
    prisma.cookingJourney.findUnique.mockResolvedValue({ id: 'j-1', stage: 'ready_to_cook', status: 'active' });
    prisma.shoppingListItem.findMany.mockResolvedValue([{ checked: true }, { checked: false }]);

    await service.updateShoppingListItem('list-1', 'i-1', 'u-1', { checked: false });

    expect(prisma.cookingJourney.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stage: 'shopping' }) }),
    );
  });

  it('does nothing when the list has no linked journey', async () => {
    prisma.shoppingList.findUnique.mockResolvedValue(ownedList());
    prisma.cookingJourney.findUnique.mockResolvedValue(null);
    prisma.shoppingListItem.findMany.mockResolvedValue([{ checked: true }]);

    await service.updateShoppingListItem('list-1', 'i-1', 'u-1', { checked: true });

    expect(prisma.cookingJourney.update).not.toHaveBeenCalled();
  });

  it('leaves a finished journey untouched', async () => {
    prisma.shoppingList.findUnique.mockResolvedValue(ownedList());
    prisma.cookingJourney.findUnique.mockResolvedValue({ id: 'j-1', stage: 'shopping', status: 'completed' });

    await service.updateShoppingListItem('list-1', 'i-1', 'u-1', { checked: true });

    expect(prisma.cookingJourney.update).not.toHaveBeenCalled();
  });

  it('does not re-sync when only the quantity changed (no checked field)', async () => {
    prisma.shoppingList.findUnique.mockResolvedValue(ownedList());

    await service.updateShoppingListItem('list-1', 'i-1', 'u-1', { quantity: '2' });

    expect(prisma.cookingJourney.findUnique).not.toHaveBeenCalled();
  });
});
