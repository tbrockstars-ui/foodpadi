import { CookTodayService } from './cook-today.service';
import { ClaudeService } from '../ai/claude.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { AuthenticatedActor, GuestActor } from '../auth/guest-or-auth.guard';

const GUEST: GuestActor = { type: 'guest', sessionId: 'guest-1', disclaimerAcknowledged: true };
const USER: AuthenticatedActor = { type: 'user', userId: 'u1', email: 'u1@example.com' };

const VALID_RAW_RECIPE = {
  title: 'AI Chicken Bowl',
  cookTimeMinutes: 25,
  servings: 2,
  cuisine: 'International',
  ingredients: [{ name: 'chicken', quantity: '2', unit: null }],
  steps: ['Cook the chicken.', 'Serve it in a bowl.'],
};

describe('CookTodayService.generate — guest never triggers AI', () => {
  let claude: { generateCookTodayRecipes: jest.Mock };
  let prisma: {
    foodPreference: { findMany: jest.Mock };
    avoidedIngredient: { findMany: jest.Mock };
    foodGoal: { findMany: jest.Mock };
  };
  let analytics: { track: jest.Mock };
  let service: CookTodayService;

  beforeEach(() => {
    claude = { generateCookTodayRecipes: jest.fn().mockResolvedValue([VALID_RAW_RECIPE]) };
    prisma = {
      foodPreference: { findMany: jest.fn().mockResolvedValue([]) },
      avoidedIngredient: { findMany: jest.fn().mockResolvedValue([]) },
      foodGoal: { findMany: jest.fn().mockResolvedValue([]) },
    };
    analytics = { track: jest.fn() };
    service = new CookTodayService(
      claude as unknown as ClaudeService,
      prisma as unknown as PrismaService,
      analytics as unknown as AnalyticsService,
    );
  });

  it('serves curated recipes to a guest and never calls ClaudeService', async () => {
    const recipes = await service.generate({ ingredients: ['pizza'] }, GUEST);

    expect(claude.generateCookTodayRecipes).not.toHaveBeenCalled();
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0]).toHaveProperty('title');
    expect(recipes[0]).toHaveProperty('steps');
  });

  it('does not touch the personalisation DB for a guest', async () => {
    await service.generate({ ingredients: ['rice'] }, GUEST);
    expect(prisma.foodPreference.findMany).not.toHaveBeenCalled();
    expect(prisma.avoidedIngredient.findMany).not.toHaveBeenCalled();
    expect(prisma.foodGoal.findMany).not.toHaveBeenCalled();
  });

  it('honours a guest time constraint best-effort', async () => {
    const recipes = await service.generate(
      { ingredients: ['rice', 'noodles', 'salad'], timeConstraintMinutes: 15 },
      GUEST,
    );
    expect(recipes.length).toBeGreaterThan(0);
    for (const r of recipes) expect(r.cookTimeMinutes).toBeLessThanOrEqual(15);
  });

  it('marks the guest analytics event as curated', async () => {
    await service.generate({ ingredients: ['pizza'] }, GUEST);
    expect(analytics.track).toHaveBeenCalledWith(
      'cook_today_recipes_generated',
      { guestSessionId: 'guest-1' },
      expect.objectContaining({ source: 'curated', guest: true, personalised: false }),
    );
  });

  it('still calls ClaudeService for a signed-in user', async () => {
    const recipes = await service.generate({ ingredients: ['chicken'] }, USER);
    expect(claude.generateCookTodayRecipes).toHaveBeenCalledTimes(1);
    expect(recipes[0].title).toBe('AI Chicken Bowl');
  });
});

describe('CookTodayService favorites engine', () => {
  let prisma: {
    recipe: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    foodFeedback: { findMany: jest.Mock };
  };
  let analytics: { track: jest.Mock };
  let service: CookTodayService;

  beforeEach(() => {
    prisma = {
      recipe: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      foodFeedback: { findMany: jest.fn().mockResolvedValue([]) },
    };
    analytics = { track: jest.fn() };
    service = new CookTodayService(
      {} as unknown as ClaudeService,
      prisma as unknown as PrismaService,
      analytics as unknown as AnalyticsService,
    );
  });

  describe('toggleFavorite', () => {
    it('sets isFavorite on a recipe the user owns', async () => {
      prisma.recipe.findUnique.mockResolvedValue({ id: 'r1', createdByUserId: 'u1', deletedAt: null });
      const result = await service.toggleFavorite('r1', 'u1', { isFavorite: true });
      expect(prisma.recipe.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { isFavorite: true } });
      expect(result).toEqual({ isFavorite: true });
    });

    it("rejects toggling another user's recipe", async () => {
      prisma.recipe.findUnique.mockResolvedValue({ id: 'r1', createdByUserId: 'someone-else', deletedAt: null });
      await expect(service.toggleFavorite('r1', 'u1', { isFavorite: true })).rejects.toThrow();
      expect(prisma.recipe.update).not.toHaveBeenCalled();
    });

    it('rejects toggling a recipe that does not exist', async () => {
      prisma.recipe.findUnique.mockResolvedValue(null);
      await expect(service.toggleFavorite('missing', 'u1', { isFavorite: true })).rejects.toThrow();
    });
  });

  describe('listFavorites', () => {
    it('includes hearted and 5-star-rated recipes in one query', async () => {
      prisma.foodFeedback.findMany.mockResolvedValue([{ entityId: 'loved-by-rating' }]);
      await service.listFavorites('u1');
      expect(prisma.foodFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'u1', entityType: 'RECIPE', rating: { gte: 5 } }),
        }),
      );
      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdByUserId: 'u1',
            OR: [{ isFavorite: true }, { id: { in: ['loved-by-rating'] } }],
          }),
        }),
      );
    });

    it('still queries correctly with no 5-star feedback at all', async () => {
      await service.listFavorites('u1');
      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: [{ isFavorite: true }, { id: { in: [] } }] }) }),
      );
    });
  });
});
