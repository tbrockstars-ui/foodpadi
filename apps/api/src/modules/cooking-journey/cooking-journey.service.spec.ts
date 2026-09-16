import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CookingJourneyService } from './cooking-journey.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CookTodayService } from '../cook-today/cook-today.service';

const RECIPE_VIEW = {
  title: 'Yam Porridge',
  cookTimeMinutes: 35,
  servings: 4,
  cuisine: 'Nigerian',
  ingredients: [
    { name: 'Yam', quantity: '1', unit: null },
    { name: 'Palm oil', quantity: '2', unit: 'tbsp' },
  ],
  steps: ['Peel and cube the yam', 'Boil with pepper and onion', 'Stir in palm oil, simmer'],
};

function recipeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'recipe-1',
    title: RECIPE_VIEW.title,
    cookTimeMinutes: RECIPE_VIEW.cookTimeMinutes,
    servings: RECIPE_VIEW.servings,
    cuisine: RECIPE_VIEW.cuisine,
    steps: RECIPE_VIEW.steps,
    createdByUserId: 'u-1',
    deletedAt: null,
    ingredients: RECIPE_VIEW.ingredients,
    ...overrides,
  };
}

function journeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'j-1',
    userId: 'u-1',
    recipeId: 'recipe-1',
    recipeSnapshot: RECIPE_VIEW,
    stage: 'recipe_selected',
    status: 'active',
    currentStep: 0,
    ingredientStatus: null,
    shoppingListId: null,
    mealPlanItemId: null,
    timerStatus: null,
    timerDurationSeconds: null,
    timerEndsAt: null,
    timerRemainingSeconds: null,
    feedbackId: null,
    cookingStartedAt: null,
    cookingCompletedAt: null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CookingJourneyService', () => {
  let prisma: any;
  let analytics: { track: jest.Mock };
  let cookToday: { save: jest.Mock; markCooked: jest.Mock };
  let service: CookingJourneyService;

  beforeEach(() => {
    prisma = {
      cookingJourney: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      recipe: { findFirst: jest.fn().mockResolvedValue(null) },
      shoppingList: { findUnique: jest.fn().mockResolvedValue(null) },
      mealPlanItem: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    analytics = { track: jest.fn().mockResolvedValue(undefined) };
    cookToday = { save: jest.fn(), markCooked: jest.fn().mockResolvedValue({}) };
    service = new CookingJourneyService(
      prisma as unknown as PrismaService,
      analytics as unknown as AnalyticsService,
      cookToday as unknown as CookTodayService,
    );
  });

  describe('getActive', () => {
    it('returns null when the user has no active journey', async () => {
      prisma.cookingJourney.findFirst.mockResolvedValue(null);
      expect(await service.getActive('u-1')).toBeNull();
    });

    it('returns a view with the resume destination resolved', async () => {
      prisma.cookingJourney.findFirst.mockResolvedValue(journeyRow({ stage: 'cooking', currentStep: 3 }));
      prisma.recipe.findFirst.mockResolvedValue(recipeRow());

      const view = await service.getActive('u-1');

      expect(view).toMatchObject({ id: 'j-1', stage: 'cooking', currentStep: 3, destination: 'cooking' });
      expect(view!.recipe.title).toBe('Yam Porridge');
    });

    it('emits cooking_journey_resumed only when the user has been away a while', async () => {
      prisma.cookingJourney.findFirst.mockResolvedValue(
        journeyRow({ lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
      );
      await service.getActive('u-1');
      expect(analytics.track).toHaveBeenCalledWith('cooking_journey_resumed', { userId: 'u-1' }, expect.any(Object));
    });

    it('does not emit cooking_journey_resumed for a fresh journey', async () => {
      prisma.cookingJourney.findFirst.mockResolvedValue(journeyRow({ lastActivityAt: new Date() }));
      await service.getActive('u-1');
      expect(analytics.track).not.toHaveBeenCalledWith('cooking_journey_resumed', expect.anything(), expect.anything());
    });

    it('falls back to the frozen snapshot when the recipe row was deleted', async () => {
      prisma.cookingJourney.findFirst.mockResolvedValue(journeyRow());
      prisma.recipe.findFirst.mockResolvedValue(null); // deleted since

      const view = await service.getActive('u-1');

      expect(view!.recipe.title).toBe('Yam Porridge');
      expect(view!.recipeId).toBeNull();
    });
  });

  describe('create', () => {
    it('persists a fresh recipe via CookTodayService.save, then starts a journey', async () => {
      cookToday.save.mockResolvedValue(recipeRow({ id: 'recipe-9' }));
      prisma.cookingJourney.create.mockResolvedValue(journeyRow({ id: 'j-9', recipeId: 'recipe-9' }));

      const view = await service.create('u-1', { recipe: RECIPE_VIEW });

      expect(cookToday.save).toHaveBeenCalled();
      expect(prisma.cookingJourney.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u-1', recipeId: 'recipe-9', stage: 'recipe_selected', status: 'active' }),
        }),
      );
      expect(analytics.track).toHaveBeenCalledWith('cooking_journey_started', { userId: 'u-1' }, expect.any(Object));
      expect(view.id).toBe('j-9');
    });

    it('409s with ACTIVE_JOURNEY_EXISTS when one is already active and replace is not set', async () => {
      prisma.cookingJourney.findFirst.mockResolvedValue(journeyRow());
      prisma.recipe.findFirst.mockResolvedValue(recipeRow());

      await expect(service.create('u-1', { recipeId: 'recipe-1' })).rejects.toMatchObject({
        constructor: ConflictException,
      });
      try {
        await service.create('u-1', { recipeId: 'recipe-1' });
      } catch (e) {
        expect((e as ConflictException).getResponse()).toMatchObject({ code: 'ACTIVE_JOURNEY_EXISTS' });
      }
      expect(prisma.cookingJourney.create).not.toHaveBeenCalled();
    });

    it('cancels the existing active journey when replace is true', async () => {
      prisma.cookingJourney.findFirst.mockResolvedValue(journeyRow({ id: 'j-old' }));
      prisma.recipe.findFirst.mockResolvedValue(recipeRow());
      prisma.cookingJourney.create.mockResolvedValue(journeyRow({ id: 'j-new' }));

      await service.create('u-1', { recipeId: 'recipe-1', replace: true });

      expect(prisma.cookingJourney.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'j-old' }, data: expect.objectContaining({ status: 'cancelled' }) }),
      );
      expect(analytics.track).toHaveBeenCalledWith(
        'cooking_journey_abandoned',
        { userId: 'u-1' },
        expect.objectContaining({ reason: 'replaced' }),
      );
      expect(prisma.cookingJourney.create).toHaveBeenCalled();
    });

    it('rejects a recipeId owned by someone else', async () => {
      prisma.recipe.findFirst.mockResolvedValue(recipeRow({ createdByUserId: 'someone-else' }));
      await expect(service.create('u-1', { recipeId: 'recipe-1' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an empty request', async () => {
      await expect(service.create('u-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('403s when the journey belongs to another user', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ userId: 'other' }));
      await expect(service.update('u-1', 'j-1', { currentStep: 2 })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('stamps cookingStartedAt the first time the stage becomes cooking', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ stage: 'ready_to_cook', cookingStartedAt: null }));
      prisma.cookingJourney.update.mockResolvedValue(journeyRow({ stage: 'cooking' }));

      await service.update('u-1', 'j-1', { stage: 'cooking' });

      const data = prisma.cookingJourney.update.mock.calls[0][0].data;
      expect(data.stage).toBe('cooking');
      expect(data.cookingStartedAt).toBeInstanceOf(Date);
      expect(analytics.track).toHaveBeenCalledWith(
        'cooking_journey_stage_changed',
        { userId: 'u-1' },
        expect.objectContaining({ from: 'ready_to_cook', to: 'cooking' }),
      );
    });

    it('emits cooking_step_completed only when the step advances', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ stage: 'cooking', currentStep: 2 }));
      prisma.cookingJourney.update.mockResolvedValue(journeyRow({ stage: 'cooking', currentStep: 3 }));

      await service.update('u-1', 'j-1', { currentStep: 3 });

      expect(analytics.track).toHaveBeenCalledWith('cooking_step_completed', { userId: 'u-1' }, expect.any(Object));
    });

    it('refuses to touch a finished journey', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ status: 'completed' }));
      await expect(service.update('u-1', 'j-1', { currentStep: 1 })).rejects.toBeInstanceOf(BadRequestException);
    });

    describe('ingredientState (fridge-scan persistence)', () => {
      const fullState = {
        v: 2 as const,
        subStage: 'reconciled' as const,
        skipped: false,
        scannedAt: '2026-09-09T12:00:00.000Z',
        detected: [
          { name: 'Yam', quantity: null, unit: null },
          { name: 'Onion', quantity: null, unit: null },
          { name: 'Milk', quantity: null, unit: null },
        ],
        confirmedNames: ['Yam', 'Onion'], // Milk rejected
        manualHave: [{ name: 'Crayfish', quantity: null, unit: null }],
        haveNames: ['Yam', 'Onion'],
        need: [{ name: 'Palm oil', note: null }, { name: 'Stock', note: null }],
        purchasedNames: ['Palm oil'],
      };

      it('stores the whole session verbatim and round-trips it through toView', async () => {
        prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ stage: 'ingredient_check' }));
        prisma.cookingJourney.update.mockResolvedValue(
          journeyRow({ stage: 'ingredient_check', ingredientStatus: fullState }),
        );

        const view = await service.update('u-1', 'j-1', { ingredientState: fullState });

        expect(prisma.cookingJourney.update.mock.calls[0][0].data.ingredientStatus).toEqual(fullState);
        // detected/rejected/confirmed distinction and the ticks survive the round trip
        expect(view.ingredientState).toMatchObject({
          confirmedNames: ['Yam', 'Onion'],
          detected: expect.arrayContaining([{ name: 'Milk', quantity: null, unit: null }]),
          purchasedNames: ['Palm oil'],
          need: [{ name: 'Palm oil', note: null }, { name: 'Stock', note: null }],
        });
        expect(analytics.track).toHaveBeenCalledWith(
          'ingredient_review_saved',
          { userId: 'u-1' },
          expect.objectContaining({ kept: 2, rejected: 1, purchasedCount: 1 }),
        );
      });

      it('a later stage-only PATCH leaves the stored ingredient session intact', async () => {
        prisma.cookingJourney.findUnique.mockResolvedValue(
          journeyRow({ stage: 'ingredient_check', ingredientStatus: fullState }),
        );
        prisma.cookingJourney.update.mockResolvedValue(
          journeyRow({ stage: 'shopping', ingredientStatus: fullState }),
        );

        await service.update('u-1', 'j-1', { stage: 'shopping' });

        // no ingredientStatus key in the update payload → column untouched
        expect(prisma.cookingJourney.update.mock.calls[0][0].data).not.toHaveProperty('ingredientStatus');
      });

      it('migrates a legacy { have, need } column on read', async () => {
        prisma.cookingJourney.findFirst.mockResolvedValue(
          journeyRow({
            stage: 'ingredient_check',
            ingredientStatus: { have: ['Yam', 'Onion'], need: ['Palm oil'] },
          }),
        );

        const view = await service.getActive('u-1');

        expect(view!.ingredientState).toMatchObject({
          v: 2,
          subStage: 'reconciled',
          haveNames: ['Yam', 'Onion'],
          need: [{ name: 'Palm oil', note: null }],
        });
      });

      it('rejects an ingredientState PATCH from a non-owner (§26/§28 isolation)', async () => {
        prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ userId: 'other-user' }));
        await expect(
          service.update('u-1', 'j-1', { ingredientState: fullState }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.cookingJourney.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('updateTimer', () => {
    beforeEach(() => {
      prisma.cookingJourney.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        journeyRow(data),
      );
    });

    it('start sets a running endsAt roughly duration seconds ahead', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ stage: 'cooking' }));
      const before = Date.now();

      await service.updateTimer('u-1', 'j-1', { action: 'start', durationSeconds: 300 });

      const data = prisma.cookingJourney.update.mock.calls[0][0].data;
      expect(data.timerStatus).toBe('running');
      expect((data.timerEndsAt as Date).getTime()).toBeGreaterThanOrEqual(before + 299_000);
      expect(data.timerRemainingSeconds).toBeNull();
    });

    it('pause freezes the remaining seconds and clears endsAt', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(
        journeyRow({
          stage: 'cooking',
          timerStatus: 'running',
          timerDurationSeconds: 300,
          timerEndsAt: new Date(Date.now() + 120_000),
        }),
      );

      await service.updateTimer('u-1', 'j-1', { action: 'pause' });

      const data = prisma.cookingJourney.update.mock.calls[0][0].data;
      expect(data.timerStatus).toBe('paused');
      expect(data.timerEndsAt).toBeNull();
      expect(data.timerRemainingSeconds).toBeGreaterThan(100);
      expect(data.timerRemainingSeconds).toBeLessThanOrEqual(120);
    });

    it('resume turns the frozen remaining back into a running endsAt', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(
        journeyRow({ stage: 'cooking', timerStatus: 'paused', timerRemainingSeconds: 90 }),
      );
      const before = Date.now();

      await service.updateTimer('u-1', 'j-1', { action: 'resume' });

      const data = prisma.cookingJourney.update.mock.calls[0][0].data;
      expect(data.timerStatus).toBe('running');
      expect((data.timerEndsAt as Date).getTime()).toBeGreaterThanOrEqual(before + 89_000);
    });

    it('start without a duration is rejected', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ stage: 'cooking' }));
      await expect(service.updateTimer('u-1', 'j-1', { action: 'start' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('complete', () => {
    it('moves to feedback_pending, stamps lastCookedAt via CookTodayService, and emits completed', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(
        journeyRow({ stage: 'cooking', cookingStartedAt: new Date(Date.now() - 20 * 60_000) }),
      );
      prisma.cookingJourney.update.mockResolvedValue(journeyRow({ stage: 'feedback_pending' }));

      const view = await service.complete('u-1', 'j-1');

      expect(prisma.cookingJourney.update.mock.calls[0][0].data.stage).toBe('feedback_pending');
      expect(cookToday.markCooked).toHaveBeenCalledWith('recipe-1', 'u-1');
      expect(analytics.track).toHaveBeenCalledWith(
        'cooking_journey_completed',
        { userId: 'u-1' },
        expect.objectContaining({ elapsedMinutes: expect.any(Number) }),
      );
      expect(view.stage).toBe('feedback_pending');
    });

    it('still completes even if marking the recipe cooked fails', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow({ stage: 'cooking' }));
      prisma.cookingJourney.update.mockResolvedValue(journeyRow({ stage: 'feedback_pending' }));
      cookToday.markCooked.mockRejectedValue(new Error('recipe gone'));

      await expect(service.complete('u-1', 'j-1')).resolves.toMatchObject({ stage: 'feedback_pending' });
    });
  });

  describe('cancel', () => {
    it('sets status cancelled and emits abandoned', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(journeyRow());

      await service.cancel('u-1', 'j-1');

      expect(prisma.cookingJourney.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'j-1' }, data: expect.objectContaining({ status: 'cancelled' }) }),
      );
      expect(analytics.track).toHaveBeenCalledWith(
        'cooking_journey_abandoned',
        { userId: 'u-1' },
        expect.objectContaining({ reason: 'user_cancelled' }),
      );
    });

    it('404s an unknown journey', async () => {
      prisma.cookingJourney.findUnique.mockResolvedValue(null);
      await expect(service.cancel('u-1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
