import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import { RecipeView, sanitizeRecipeCandidate } from '../ai/recipe-validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { GenerateRecipesDto } from './dto/generate-recipes.dto';
import { SaveRecipeDto } from './dto/save-recipe.dto';

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
    const raw = await this.claude.generateCookTodayRecipes({
      ingredients: dto.ingredients,
      timeConstraintMinutes: dto.timeConstraintMinutes,
      servings: dto.servings,
    });

    const validated = raw
      .map((candidate) => sanitizeRecipeCandidate(candidate, dto.timeConstraintMinutes))
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
