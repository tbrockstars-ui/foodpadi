import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClaudeService, RawRecipeCandidate } from '../ai/claude.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { GenerateRecipesDto } from './dto/generate-recipes.dto';
import { SaveRecipeDto } from './dto/save-recipe.dto';

export interface RecipeIngredientView {
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface RecipeView {
  title: string;
  cookTimeMinutes: number;
  servings: number;
  cuisine: string | null;
  ingredients: RecipeIngredientView[];
  steps: string[];
}

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

  /**
   * Layer 5 (Claude) proposes candidates; this method is Layer 3 — nothing
   * the model returns reaches the user unless it passes these deterministic
   * sanity checks (docs/AI_ARCHITECTURE.md, docs/TEST_STRATEGY.md's AI eval
   * requirements: no negative/zero time or servings, no empty steps, no
   * duplicate ingredients within one recipe).
   */
  async generate(dto: GenerateRecipesDto, actor: RequestActor): Promise<RecipeView[]> {
    const raw = await this.claude.generateCookTodayRecipes({
      ingredients: dto.ingredients,
      timeConstraintMinutes: dto.timeConstraintMinutes,
      servings: dto.servings,
    });

    const validated = raw
      .map((candidate) => this.sanitize(candidate, dto.timeConstraintMinutes))
      .filter((recipe): recipe is RecipeView => recipe !== null);

    if (validated.length === 0) {
      this.logger.warn('All generated recipe candidates failed validation.');
    }

    await this.analytics.track('cook_today_recipes_generated', actorToAnalyticsFields(actor), {
      ingredientCount: dto.ingredients.length,
      resultCount: validated.length,
    });

    return validated;
  }

  private sanitize(candidate: RawRecipeCandidate, timeLimit?: number): RecipeView | null {
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    const cookTimeMinutes = Number(candidate.cookTimeMinutes);
    const servings = Number(candidate.servings);
    const cuisine = typeof candidate.cuisine === 'string' ? candidate.cuisine : null;
    const steps = Array.isArray(candidate.steps)
      ? candidate.steps.filter((step): step is string => typeof step === 'string' && step.trim().length > 0)
      : [];
    const rawIngredients = Array.isArray(candidate.ingredients) ? candidate.ingredients : [];

    const ingredients: RecipeIngredientView[] = [];
    const seenNames = new Set<string>();
    for (const item of rawIngredients) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (!name) continue;
      const normalized = name.toLowerCase();
      if (seenNames.has(normalized)) continue; // no duplicate ingredients within one recipe
      seenNames.add(normalized);
      ingredients.push({
        name,
        quantity: typeof record.quantity === 'string' ? record.quantity : null,
        unit: typeof record.unit === 'string' ? record.unit : null,
      });
    }

    if (
      !title ||
      !Number.isFinite(cookTimeMinutes) ||
      cookTimeMinutes <= 0 ||
      !Number.isFinite(servings) ||
      servings <= 0 ||
      steps.length < 2 ||
      ingredients.length === 0
    ) {
      this.logger.warn(`Dropped an invalid recipe candidate: ${JSON.stringify(candidate).slice(0, 300)}`);
      return null;
    }

    if (timeLimit && cookTimeMinutes > timeLimit) {
      this.logger.warn(`Dropped a recipe exceeding the requested time limit: "${title}"`);
      return null;
    }

    return { title, cookTimeMinutes, servings, cuisine, ingredients, steps };
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
