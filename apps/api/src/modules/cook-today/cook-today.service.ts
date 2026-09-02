import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { FoodGoal } from '@foodpadi/shared';
import { ClaudeService } from '../ai/claude.service';
import { pickCuratedRecipes } from '../ai/curated-recipes';
import { goalGuidanceLine } from '../ai/goal-guidance';
import { RecipeView, sanitizeRecipeCandidate } from '../ai/recipe-validation';
import { dropRecipesWithAvoided } from '../../common/avoided-ingredients';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { GenerateRecipesDto } from './dto/generate-recipes.dto';
import { SaveRecipeDto } from './dto/save-recipe.dto';

interface CookPersonalisation {
  favouriteCuisines: string[];
  avoidedIngredients: string[];
  goalGuidance?: string;
}

const EMPTY_PERSONALISATION: CookPersonalisation = { favouriteCuisines: [], avoidedIngredients: [] };

export type { RecipeIngredientView, RecipeView } from '../ai/recipe-validation';

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

@Injectable()
export class CookTodayService {
  private readonly logger = new Logger(CookTodayService.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async generate(dto: GenerateRecipesDto, actor: RequestActor): Promise<RecipeView[]> {
    // A guest must never trigger a paid AI call (guest-mode brief §2/§22).
    // They get deterministic recipes from the curated pool instead — the same
    // Layer 3 validation, no ClaudeService, nothing stored to personalise
    // from. Also covers the "cook it" lane of guest Decide, which calls this.
    if (actor.type === 'guest') {
      return this.generateForGuest(dto, actor);
    }

    // Signed-in users get recipes shaped by their Preferences + Goals
    // (favourite cuisines, avoided ingredients, food goals) — same treatment
    // Eat Now and Plan Ahead already give. Also reached via DecideService, so
    // the "cook it" options in "What should I eat?" are personalised too.
    const personalisation = await this.loadPersonalisation(actor);

    const raw = await this.claude.generateCookTodayRecipes({
      ingredients: dto.ingredients,
      timeConstraintMinutes: dto.timeConstraintMinutes,
      servings: dto.servings,
      favouriteCuisines: personalisation.favouriteCuisines,
      avoidedIngredients: personalisation.avoidedIngredients,
      goalGuidance: personalisation.goalGuidance,
    });

    const validated = raw
      .map((candidate) => sanitizeRecipeCandidate(candidate, dto.timeConstraintMinutes))
      .filter((recipe): recipe is RecipeView => recipe !== null);

    // Hard exclusion — the prompt already asks the model to avoid these, but
    // the demo/curated fallback never sees the prompt and a live model can
    // still slip, so drop any recipe that names an avoided ingredient rather
    // than trusting the generator. Substring match, mirroring EatNowService.
    const safe = dropRecipesWithAvoided(validated, personalisation.avoidedIngredients);

    if (safe.length === 0) {
      this.logger.warn(
        validated.length === 0
          ? 'All generated recipe candidates failed validation.'
          : 'Every generated recipe was filtered out by the user\'s avoided ingredients.',
      );
    }

    await this.analytics.track('cook_today_recipes_generated', actorToAnalyticsFields(actor), {
      ingredientCount: dto.ingredients.length,
      resultCount: safe.length,
      personalised:
        personalisation.favouriteCuisines.length > 0 ||
        personalisation.avoidedIngredients.length > 0 ||
        !!personalisation.goalGuidance,
    });

    return safe;
  }

  /**
   * Guest Cook Today / guest Decide "cook it" lane — deterministic, no AI.
   * The time constraint is honoured best-effort inside pickCuratedRecipes and
   * deliberately NOT re-applied in sanitizeRecipeCandidate here: a guest has
   * no Eat Now "get it" fallback in Cook Today, so a slightly-too-long
   * curated recipe beats an empty result they can't act on.
   */
  private async generateForGuest(
    dto: GenerateRecipesDto,
    actor: RequestActor,
  ): Promise<RecipeView[]> {
    const raw = pickCuratedRecipes(dto.ingredients.join(' '), 3, {
      maxMinutes: dto.timeConstraintMinutes,
    });
    const recipes = raw
      .map((candidate) => sanitizeRecipeCandidate(candidate))
      .filter((recipe): recipe is RecipeView => recipe !== null);

    await this.analytics.track('cook_today_recipes_generated', actorToAnalyticsFields(actor), {
      ingredientCount: dto.ingredients.length,
      resultCount: recipes.length,
      personalised: false,
      source: 'curated',
      guest: true,
    });

    return recipes;
  }

  private async loadPersonalisation(actor: RequestActor): Promise<CookPersonalisation> {
    if (actor.type !== 'user') return EMPTY_PERSONALISATION;

    const [preferences, avoided, goals] = await Promise.all([
      this.prisma.foodPreference.findMany({
        where: { userId: actor.userId, deletedAt: null, cuisine: { not: null } },
      }),
      this.prisma.avoidedIngredient.findMany({ where: { userId: actor.userId, deletedAt: null } }),
      this.prisma.foodGoal.findMany({ where: { userId: actor.userId, isActive: true } }),
    ]);

    const personalNote = goals.find((g) => g.goalType === 'personal')?.note ?? null;

    return {
      favouriteCuisines: preferences
        .map((p) => p.cuisine)
        .filter((c): c is string => !!c),
      avoidedIngredients: avoided.map((a) => a.ingredientName),
      goalGuidance:
        goalGuidanceLine({ goalTypes: goals.map((g) => g.goalType as FoodGoal), personalNote }) ?? undefined,
    };
  }

  /** Layer 6 — only a signed-in user can persist a recipe. */
  async save(dto: SaveRecipeDto, userId: string) {
    const recipe = await this.prisma.recipe.create({
      data: {
        title: dto.title,
        cookTimeMinutes: dto.cookTimeMinutes,
        servings: dto.servings,
        cuisine: dto.cuisine,
        steps: dto.steps,
        createdByUserId: userId,
        ingredients: {
          create: dto.ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          })),
        },
      },
      include: { ingredients: true },
    });

    await this.analytics.track('cook_today_recipe_saved', { userId }, { recipeId: recipe.id });

    return recipe;
  }

  async listSaved(userId: string) {
    return this.prisma.recipe.findMany({
      where: { createdByUserId: userId, deletedAt: null },
      include: { ingredients: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(recipeId: string, userId: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe || recipe.deletedAt) {
      throw new NotFoundException('Recipe not found.');
    }
    if (recipe.createdByUserId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.recipe.update({ where: { id: recipeId }, data: { deletedAt: new Date() } });
  }
}
