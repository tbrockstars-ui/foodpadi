import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import { RecipeView, sanitizeRecipeCandidate } from '../ai/recipe-validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AddShoppingListItemDto, UpdateShoppingListItemDto } from './dto/shopping-list-item.dto';
import { GeneratePlanDto, PlanScope } from './dto/generate-plan.dto';
import { UpdateMealPlanItemDto } from './dto/update-meal-plan-item.dto';
import { RegeneratePlanItemDto } from './dto/regenerate-plan-item.dto';
import { GenerateShoppingListDto } from './dto/generate-shopping-list.dto';

const SCOPE_DAYS: Record<Exclude<PlanScope, 'custom'>, number> = {
  today: 1,
  tomorrow: 1,
  '3day': 3,
  week: 7,
};

const MAX_PLAN_DAYS = 14;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

type PlanItemsForConsolidation = Array<{
  recipe: { ingredients: { name: string; quantity: string | null; unit: string | null }[] } | null;
}>;

@Injectable()
export class PlanAheadService {
  private readonly logger = new Logger(PlanAheadService.name);

  constructor(
    private readonly claude: ClaudeService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  private resolveDayCount(dto: GeneratePlanDto): number {
    if (dto.scope === 'custom') {
      if (!dto.customDays) {
        throw new BadRequestException('customDays is required when scope is "custom".');
      }
      return dto.customDays;
    }
    return SCOPE_DAYS[dto.scope];
  }

  // 'tomorrow' plans the next day; everything else starts today.
  private startDateForScope(scope: PlanScope): Date {
    return scope === 'tomorrow' ? addDays(startOfToday(), 1) : startOfToday();
  }

  async generate(dto: GeneratePlanDto, userId: string) {
    const days = this.resolveDayCount(dto);

    const [preferences, avoided] = await Promise.all([
      this.prisma.foodPreference.findMany({ where: { userId, deletedAt: null, cuisine: { not: null } } }),
      this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null } }),
    ]);

    const raw = await this.claude.generatePlanMeals({
      days,
      budgetPence: dto.budgetPence,
      favouriteCuisines: preferences.map((p) => p.cuisine).filter((c): c is string => !!c),
      avoidedIngredients: avoided.map((a) => a.ingredientName),
    });

    const validated = raw
      .map((candidate) => sanitizeRecipeCandidate(candidate))
      .filter((recipe): recipe is RecipeView => recipe !== null);

    if (validated.length === 0) {
      throw new BadRequestException('Could not generate a meal plan right now. Please try again.');
    }

    const startDate = this.startDateForScope(dto.scope);
    const endDate = addDays(startDate, Math.max(validated.length, days) - 1);

    const plan = await this.prisma.mealPlan.create({
      data: {
        userId,
        scope: dto.scope,
        startDate,
        endDate,
        budgetPence: dto.budgetPence,
        status: 'draft',
        items: {
          create: validated.map((recipe, index) => ({
            plannedDate: addDays(startDate, index),
            mealSlot: 'dinner',
            servings: recipe.servings,
            recipe: {
              create: {
                title: recipe.title,
                cookTimeMinutes: recipe.cookTimeMinutes,
                servings: recipe.servings,
                cuisine: recipe.cuisine,
                steps: recipe.steps,
                createdByUserId: userId,
                ingredients: { create: recipe.ingredients },
              },
            },
          })),
        },
      },
      include: this.planInclude(),
    });

    await this.analytics.track('plan_ahead_generated', { userId }, { scope: dto.scope, days: validated.length });

    return this.serialize(plan);
  }

  async getCurrent(userId: string) {
    const plan = await this.prisma.mealPlan.findFirst({
      where: { userId, deletedAt: null, status: { in: ['draft', 'accepted'] } },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    return plan ? this.serialize(plan) : null;
  }

  // Every non-deleted plan the user has ever generated, newest first — the
  // "saved plans" list (auto-saved, same as the DB already worked; delete to
  // remove). Mirrors Cook Today's saved-recipes list.
  async list(userId: string) {
    const plans = await this.prisma.mealPlan.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
    return plans.map((plan) => this.serialize(plan));
  }

  async accept(planId: string, userId: string) {
    await this.ownedPlan(planId, userId);
    const plan = await this.prisma.mealPlan.update({
      where: { id: planId },
      data: { status: 'accepted' },
      include: this.planInclude(),
    });
    await this.analytics.track('plan_ahead_accepted', { userId }, { planId });
    return this.serialize(plan);
  }

  // Soft delete — same "suspend, don't destroy" precedent as recipes/users.
  async remove(planId: string, userId: string) {
    await this.ownedPlan(planId, userId);
    await this.prisma.mealPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } });
    await this.analytics.track('plan_ahead_deleted', { userId }, { planId });
  }

  // Powers the "Replace with something specific" typeahead — titles the
  // user can pick from rather than free-typing a hint and finding out only
  // after submitting whether anything matched. Source depends on the same
  // ANTHROPIC_API_KEY branch as generatePlanMeals itself:
  //  - demo mode: the curated pool regenerateItem will actually search, so
  //    every suggestion offered is guaranteed to produce a real replacement.
  //  - real AI mode: the FoodIdea catalog as broad inspiration — the AI can
  //    honour an arbitrary specific dish fine, this pool doesn't need to be
  //    a guaranteed-match set the way the demo one does.
  async searchMealIdeas(query: string): Promise<string[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    if (!process.env.ANTHROPIC_API_KEY) {
      return this.claude.searchCuratedRecipeTitles(trimmed, 6);
    }

    const rows = await this.prisma.foodIdea.findMany({
      where: { isActive: true, title: { contains: trimmed, mode: 'insensitive' } },
      select: { title: true },
      take: 6,
      orderBy: { title: 'asc' },
    });
    return rows.map((r) => r.title);
  }

  async regenerateItem(planId: string, itemId: string, userId: string, dto: RegeneratePlanItemDto = {}) {
    const plan = await this.ownedPlan(planId, userId);
    const item = plan.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException('Meal plan item not found.');
    }

    const [preferences, avoided] = await Promise.all([
      this.prisma.foodPreference.findMany({ where: { userId, deletedAt: null, cuisine: { not: null } } }),
      this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null } }),
    ]);

    const raw = await this.claude.generatePlanMeals({
      days: 1,
      favouriteCuisines: preferences.map((p) => p.cuisine).filter((c): c is string => !!c),
      avoidedIngredients: avoided.map((a) => a.ingredientName),
      focus: dto.focus,
    });
    const [candidate] = raw.map((c) => sanitizeRecipeCandidate(c)).filter((r): r is RecipeView => r !== null);
    if (!candidate) {
      throw new BadRequestException(
        dto.focus
          ? `Couldn't find a meal matching "${dto.focus}" right now. Try describing it differently.`
          : 'Could not find a replacement meal right now. Please try again.',
      );
    }

    const recipe = await this.prisma.recipe.create({
      data: {
        title: candidate.title,
        cookTimeMinutes: candidate.cookTimeMinutes,
        servings: candidate.servings,
        cuisine: candidate.cuisine,
        steps: candidate.steps,
        createdByUserId: userId,
        ingredients: { create: candidate.ingredients },
      },
    });

    await this.prisma.mealPlanItem.update({
      where: { id: itemId },
      data: { recipeId: recipe.id, servings: candidate.servings },
    });

    await this.analytics.track('plan_ahead_item_regenerated', { userId }, {
      planId,
      itemId,
      focused: !!dto.focus,
    });

    // An accepted plan whose day changed should keep its shopping list in
    // step — rebuild the auto-derived items, keep anything added by hand.
    await this.rebuildShoppingListForPlan(planId, userId);

    const fresh = await this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
    return this.serialize(fresh);
  }

  // Rebuild every day of the plan from scratch (same scope/budget), for when
  // the whole plan misses rather than a single day. Keeps the plan's id,
  // start date and status; re-derives an existing shopping list.
  async regeneratePlan(planId: string, userId: string) {
    const plan = await this.ownedPlan(planId, userId);
    const days = Math.min(daysBetweenInclusive(plan.startDate, plan.endDate), MAX_PLAN_DAYS);

    const [preferences, avoided] = await Promise.all([
      this.prisma.foodPreference.findMany({ where: { userId, deletedAt: null, cuisine: { not: null } } }),
      this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null } }),
    ]);

    const raw = await this.claude.generatePlanMeals({
      days,
      budgetPence: plan.budgetPence ?? undefined,
      favouriteCuisines: preferences.map((p) => p.cuisine).filter((c): c is string => !!c),
      avoidedIngredients: avoided.map((a) => a.ingredientName),
    });

    const validated = raw
      .map((candidate) => sanitizeRecipeCandidate(candidate))
      .filter((recipe): recipe is RecipeView => recipe !== null);

    if (validated.length === 0) {
      throw new BadRequestException('Could not rebuild the plan right now. Please try again.');
    }

    const startDate = plan.startDate;
    const endDate = addDays(startDate, validated.length - 1);

    await this.prisma.$transaction([
      this.prisma.mealPlanItem.deleteMany({ where: { mealPlanId: planId } }),
      this.prisma.mealPlan.update({
        where: { id: planId },
        data: {
          endDate,
          items: {
            create: validated.map((recipe, index) => ({
              plannedDate: addDays(startDate, index),
              mealSlot: 'dinner',
              servings: recipe.servings,
              recipe: {
                create: {
                  title: recipe.title,
                  cookTimeMinutes: recipe.cookTimeMinutes,
                  servings: recipe.servings,
                  cuisine: recipe.cuisine,
                  steps: recipe.steps,
                  createdByUserId: userId,
                  ingredients: { create: recipe.ingredients },
                },
              },
            })),
          },
        },
      }),
    ]);

    await this.analytics.track('plan_ahead_regenerated', { userId }, { planId, days: validated.length });

    await this.rebuildShoppingListForPlan(planId, userId);

    const fresh = await this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
    return this.serialize(fresh);
  }

  async updateItem(planId: string, itemId: string, userId: string, dto: UpdateMealPlanItemDto) {
    const plan = await this.ownedPlan(planId, userId);
    if (!plan.items.some((i) => i.id === itemId)) {
      throw new NotFoundException('Meal plan item not found.');
    }

    await this.prisma.mealPlanItem.update({
      where: { id: itemId },
      data: {
        ...(dto.mealChoice !== undefined ? { mealChoice: dto.mealChoice } : {}),
        ...(dto.plannedTime !== undefined ? { plannedTime: dto.plannedTime } : {}),
      },
    });

    await this.analytics.track('plan_ahead_item_updated', { userId }, {
      planId,
      itemId,
      mealChoice: dto.mealChoice,
      hasTime: dto.plannedTime !== undefined ? dto.plannedTime !== null : undefined,
    });

    const fresh = await this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
    return this.serialize(fresh);
  }

  async removeItem(planId: string, itemId: string, userId: string) {
    const plan = await this.ownedPlan(planId, userId);
    if (!plan.items.some((i) => i.id === itemId)) {
      throw new NotFoundException('Meal plan item not found.');
    }
    await this.prisma.mealPlanItem.delete({ where: { id: itemId } });
    await this.rebuildShoppingListForPlan(planId, userId);
    const fresh = await this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
    return this.serialize(fresh);
  }

  async generateShoppingList(planId: string, userId: string, dto: GenerateShoppingListDto = {}) {
    const plan = await this.ownedPlan(planId, userId);
    if (plan.status !== 'accepted') {
      throw new BadRequestException('Accept the plan before generating a shopping list.');
    }

    const existing = await this.prisma.shoppingList.findFirst({
      where: { mealPlanId: planId, userId },
      include: { items: true },
    });

    if (existing && !dto.regenerate) return existing;

    if (existing && dto.regenerate) {
      const rebuilt = await this.rebuildShoppingListItems(existing.id, plan.items);
      await this.analytics.track('shopping_list_regenerated', { userId }, {
        planId,
        itemCount: rebuilt.items.filter((i) => !i.addedManually).length,
      });
      return rebuilt;
    }

    const consolidated = this.consolidateIngredients(plan.items);

    const list = await this.prisma.shoppingList.create({
      data: {
        userId,
        mealPlanId: planId,
        items: { create: consolidated },
      },
      include: { items: true },
    });

    await this.analytics.track('shopping_list_generated', { userId }, { planId, itemCount: consolidated.length });

    return list;
  }

  // Replace a list's auto-derived items with a fresh consolidation of the
  // plan's current meals; anything the user added by hand (addedManually) is
  // left in place.
  private async rebuildShoppingListItems(listId: string, planItems: PlanItemsForConsolidation) {
    const consolidated = this.consolidateIngredients(planItems);
    await this.prisma.$transaction([
      this.prisma.shoppingListItem.deleteMany({ where: { shoppingListId: listId, addedManually: false } }),
      this.prisma.shoppingListItem.createMany({
        data: consolidated.map((item) => ({ ...item, shoppingListId: listId })),
      }),
    ]);
    return this.prisma.shoppingList.findUniqueOrThrow({ where: { id: listId }, include: { items: true } });
  }

  // Called after any edit that changes a plan's meals — keeps that plan's
  // shopping list (if one exists) in step. No-op when there's no list yet.
  private async rebuildShoppingListForPlan(planId: string, userId: string) {
    const list = await this.prisma.shoppingList.findFirst({ where: { mealPlanId: planId, userId } });
    if (!list) return;
    const plan = await this.prisma.mealPlan.findUnique({ where: { id: planId }, include: this.planInclude() });
    if (!plan) return;
    await this.rebuildShoppingListItems(list.id, plan.items);
  }

  async getShoppingList(listId: string, userId: string) {
    const list = await this.prisma.shoppingList.findUnique({ where: { id: listId }, include: { items: true } });
    if (!list || list.userId !== userId) {
      throw new NotFoundException('Shopping list not found.');
    }
    return list;
  }

  async updateShoppingListItem(listId: string, itemId: string, userId: string, dto: UpdateShoppingListItemDto) {
    await this.getShoppingList(listId, userId); // ownership check
    return this.prisma.shoppingListItem.update({ where: { id: itemId }, data: dto });
  }

  async addShoppingListItem(listId: string, userId: string, dto: AddShoppingListItemDto) {
    await this.getShoppingList(listId, userId);
    return this.prisma.shoppingListItem.create({
      data: { shoppingListId: listId, ingredientName: dto.ingredientName, quantity: dto.quantity, unit: dto.unit, addedManually: true },
    });
  }

  async removeShoppingListItem(listId: string, itemId: string, userId: string) {
    await this.getShoppingList(listId, userId);
    await this.prisma.shoppingListItem.delete({ where: { id: itemId } });
  }

  private consolidateIngredients(items: PlanItemsForConsolidation) {
    const map = new Map<string, { displayName: string; parts: Set<string> }>();
    for (const item of items) {
      if (!item.recipe) continue;
      for (const ingredient of item.recipe.ingredients) {
        const key = ingredient.name.toLowerCase();
        const part = [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ').trim();
        const entry = map.get(key) ?? { displayName: ingredient.name, parts: new Set<string>() };
        if (part) entry.parts.add(part);
        map.set(key, entry);
      }
    }
    return Array.from(map.values()).map((entry) => ({
      ingredientName: entry.displayName,
      quantity: entry.parts.size > 0 ? Array.from(entry.parts).join(', ') : null,
      unit: null,
    }));
  }

  private planInclude() {
    return {
      items: {
        include: { recipe: { include: { ingredients: true } } },
        orderBy: { plannedDate: 'asc' as const },
      },
      // Practically one list per plan; take the newest if somehow more.
      shoppingLists: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true } },
    };
  }

  // Flattens the plan's one-and-only shopping list to a `shoppingListId` field
  // (MealPlanView) and drops the raw relation, so clients get a stable shape.
  private serialize<T extends { shoppingLists: { id: string }[] }>(plan: T) {
    const { shoppingLists, ...rest } = plan;
    return { ...rest, shoppingListId: shoppingLists[0]?.id ?? null };
  }

  private async ownedPlan(planId: string, userId: string) {
    const plan = await this.prisma.mealPlan.findUnique({ where: { id: planId }, include: this.planInclude() });
    if (!plan || plan.deletedAt) {
      throw new NotFoundException('Meal plan not found.');
    }
    if (plan.userId !== userId) {
      throw new ForbiddenException();
    }
    return plan;
  }
}
