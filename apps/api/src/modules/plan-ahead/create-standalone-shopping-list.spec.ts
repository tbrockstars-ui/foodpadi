import { NotFoundException } from '@nestjs/common';
import { PlanAheadService } from './plan-ahead.service';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementService } from '../billing/entitlement.service';
import { CookingInsightsService } from '../feedback/cooking-insights.service';

// Same lightweight constructor-mock pattern as plan-preview.service.spec.ts —
// PlanAheadService takes exactly these 5 deps.
describe('PlanAheadService.createStandaloneShoppingList', () => {
  let prisma: {
    shoppingList: { create: jest.Mock; findUnique: jest.Mock };
    cookingJourney: { findUnique: jest.Mock; update: jest.Mock };
  };
  let analytics: { track: jest.Mock };
  let service: PlanAheadService;

  beforeEach(() => {
    prisma = {
      shoppingList: { create: jest.fn(), findUnique: jest.fn() },
      cookingJourney: { findUnique: jest.fn(), update: jest.fn() },
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

  const listRow = (over: Record<string, unknown> = {}) => ({
    id: 'list-1',
    userId: 'u-1',
    status: 'open',
    mealPlanId: null,
    items: [],
    cookingJourney: null,
    ...over,
  });

  it('creates a list with mealPlanId null, scoped to the given user', async () => {
    prisma.shoppingList.create.mockResolvedValue(listRow());

    await service.createStandaloneShoppingList('u-1', {
      items: [{ ingredientName: 'Chicken', quantity: '500', unit: 'g' }],
    });

    expect(prisma.shoppingList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-1',
          mealPlanId: null,
          items: {
            create: [{ ingredientName: 'Chicken', quantity: '500', unit: 'g', addedManually: true }],
          },
        }),
      }),
    );
  });

  it('creates one item per entry, preserving order', async () => {
    prisma.shoppingList.create.mockResolvedValue(listRow());

    await service.createStandaloneShoppingList('u-1', {
      items: [
        { ingredientName: 'Chicken' },
        { ingredientName: 'Stock', unit: 'litre' },
        { ingredientName: 'Scotch bonnet', quantity: '2' },
      ],
    });

    const { items } = prisma.shoppingList.create.mock.calls[0][0].data;
    expect(items.create).toHaveLength(3);
    expect(items.create.map((i: { ingredientName: string }) => i.ingredientName)).toEqual([
      'Chicken',
      'Stock',
      'Scotch bonnet',
    ]);
  });

  it('tracks a shopping_list_generated analytics event tagged as standalone', async () => {
    prisma.shoppingList.create.mockResolvedValue(listRow());

    await service.createStandaloneShoppingList('u-1', { items: [{ ingredientName: 'Chicken' }] });

    expect(analytics.track).toHaveBeenCalledWith(
      'shopping_list_generated',
      { userId: 'u-1' },
      expect.objectContaining({ source: 'standalone', itemCount: 1 }),
    );
  });

  it('returns the ShoppingListView shape (id, status, mealPlanId, items, cookingJourney)', async () => {
    prisma.shoppingList.create.mockResolvedValue(
      listRow({ items: [{ id: 'i-1', ingredientName: 'Chicken', quantity: null, unit: null, checked: false, addedManually: true }] }),
    );

    const result = await service.createStandaloneShoppingList('u-1', { items: [{ ingredientName: 'Chicken' }] });

    expect(result).toEqual({
      id: 'list-1',
      status: 'open',
      mealPlanId: null,
      cookingJourney: null,
      items: [{ id: 'i-1', ingredientName: 'Chicken', quantity: null, unit: null, checked: false, addedManually: true }],
    });
  });

  describe('when linked to an active Cooking Journey', () => {
    it('links the new list to the journey and moves it to the shopping stage', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue({ userId: 'u-1', status: 'active', stage: 'ingredient_check' });
      prisma.shoppingList.create.mockResolvedValue(listRow());
      prisma.shoppingList.findUnique.mockResolvedValue(
        listRow({ cookingJourney: { id: 'j-1', stage: 'shopping', status: 'active', recipeSnapshot: { title: 'Yam Porridge' } } }),
      );

      const result = await service.createStandaloneShoppingList('u-1', {
        items: [{ ingredientName: 'Palm oil' }],
        cookingJourneyId: 'j-1',
      });

      expect(prisma.cookingJourney.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'j-1' },
          data: expect.objectContaining({ shoppingListId: 'list-1', stage: 'shopping' }),
        }),
      );
      expect(result.cookingJourney).toEqual({ id: 'j-1', recipeTitle: 'Yam Porridge', stage: 'shopping' });
      expect(analytics.track).toHaveBeenCalledWith(
        'cooking_journey_stage_changed',
        { userId: 'u-1' },
        expect.objectContaining({ to: 'shopping' }),
      );
    });

    it('404s a journey the user does not own', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue({ userId: 'someone-else', status: 'active' });

      await expect(
        service.createStandaloneShoppingList('u-1', { items: [{ ingredientName: 'Palm oil' }], cookingJourneyId: 'j-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.shoppingList.create).not.toHaveBeenCalled();
    });

    it('ignores a journey that is no longer active (creates a plain list)', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue({ userId: 'u-1', status: 'completed' });
      prisma.shoppingList.create.mockResolvedValue(listRow());

      await service.createStandaloneShoppingList('u-1', {
        items: [{ ingredientName: 'Palm oil' }],
        cookingJourneyId: 'j-1',
      });

      expect(prisma.cookingJourney.update).not.toHaveBeenCalled();
    });
  });
});
