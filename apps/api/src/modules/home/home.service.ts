import { Injectable } from '@nestjs/common';
import type { HomeIdeasResponse, RecentlyCookedResponse } from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestActor } from '../auth/guest-or-auth.guard';
import { HomeIdeasQueryDto } from './dto/home-ideas-query.dto';
import { rankHomeIdeas, type IdeaContext } from './home-ideas';

const EMPTY_CONTEXT: IdeaContext = {
  pantryItems: [],
  avoidedIngredients: [],
  favouriteCuisines: [],
  activeGoals: [],
};

// Home shows a handful of recent cooks, not a full history — that lives on
// the Saved Recipes screen already.
const RECENTLY_COOKED_LIMIT = 5;

function liveSignals(query: HomeIdeasQueryDto): Pick<IdeaContext, 'moodHint' | 'maxTimeMinutes' | 'maxBudgetPence'> {
  return {
    moodHint: query.mood?.trim() || undefined,
    maxTimeMinutes: query.maxTime,
    maxBudgetPence: query.maxBudget !== undefined ? query.maxBudget * 100 : undefined,
  };
}

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "Ideas for you" — curated pool scored against the member's own data,
   * plus whatever live mood/time/budget signal the "What should I eat?"
   * search box sent this time (see home-ideas.ts's IdeaContext/scoreRecipe).
   * A guest (or a member with nothing saved yet) gets a stable, sensible
   * default ordering with no `matchPercent`, never an error or an empty feed.
   */
  async getIdeas(actor: RequestActor, query: HomeIdeasQueryDto = {}): Promise<HomeIdeasResponse> {
    const live = liveSignals(query);

    if (actor.type !== 'user') {
      return { ideas: rankHomeIdeas({ ...EMPTY_CONTEXT, ...live }) };
    }

    const userId = actor.userId;
    const [pantry, avoided, preferences, goals] = await Promise.all([
      this.prisma.pantryItem.findMany({ where: { userId, deletedAt: null }, select: { name: true } }),
      this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null }, select: { ingredientName: true } }),
      this.prisma.foodPreference.findMany({
        where: { userId, deletedAt: null, cuisine: { not: null } },
        select: { cuisine: true },
      }),
      this.prisma.foodGoal.findMany({ where: { userId, isActive: true }, select: { goalType: true } }),
    ]);

    const ctx: IdeaContext = {
      pantryItems: pantry.map((p) => p.name),
      avoidedIngredients: avoided.map((a) => a.ingredientName),
      favouriteCuisines: [
        ...new Set(preferences.map((p) => p.cuisine).filter((c): c is string => !!c).map((c) => c.toLowerCase())),
      ],
      activeGoals: goals.map((g) => g.goalType),
      ...live,
    };

    return { ideas: rankHomeIdeas(ctx) };
  }

  /**
   * "Recently cooked" — real cook history, driven entirely by
   * Recipe.lastCookedAt (stamped by CookTodayService.markCooked when a
   * guided cooking session finishes). A guest has nothing persisted, so this
   * is always empty for them rather than a special-cased response shape.
   */
  async getRecentlyCooked(actor: RequestActor): Promise<RecentlyCookedResponse> {
    if (actor.type !== 'user') {
      return { items: [] };
    }

    const recipes = await this.prisma.recipe.findMany({
      where: { createdByUserId: actor.userId, deletedAt: null, lastCookedAt: { not: null } },
      select: { id: true, title: true, cuisine: true, lastCookedAt: true, isFavorite: true },
      orderBy: { lastCookedAt: 'desc' },
      take: RECENTLY_COOKED_LIMIT,
    });

    return {
      items: recipes.map((r) => ({
        id: r.id,
        title: r.title,
        cuisine: r.cuisine,
        // Non-null by the where clause above; Prisma's generated type just
        // doesn't narrow it.
        lastCookedAt: r.lastCookedAt!.toISOString(),
        // Favorites engine (CookTodayService.toggleFavorite/listFavorites) —
        // lets the heart on this row reflect real state instead of always
        // starting unliked.
        isFavorite: r.isFavorite,
      })),
    };
  }
}
