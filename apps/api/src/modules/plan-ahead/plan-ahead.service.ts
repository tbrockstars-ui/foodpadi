import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import { RecipeView, sanitizeRecipeCandidate } from '../ai/recipe-validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AddShoppingListItemDto, UpdateShoppingListItemDto } from './dto/shopping-list-item.dto';
import { GeneratePlanDto, PlanScope } from './dto/generate-plan.dto';
import { UpdateMealPlanItemDto } from './dto/update-meal-plan-item.dto';

const SCOPE_DAYS: Record<Exclude<PlanScope, 'custom'>, number> = {
  today: 1,
  '3day': 3,
  week: 7,
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

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

    const startDate = startOfToday();
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

    return plan;
  }

  async getCurrent(userId: string) {
    return this.prisma.mealPlan.findFirst({
      where: { userId, deletedAt: null, status: { in: ['draft', 'accepted'] } },
      orderBy: { createdAt: 'desc' },
      include: this.planInclude(),
    });
  }

  async accept(planId: string, userId: string) {
    await this.ownedPlan(planId, userId);
    const plan = await this.prisma.mealPlan.update({
      where: { id: planId },
      data: { status: 'accepted' },
      include: this.planInclude(),
    });
    await this.analytics.track('plan_ahead_accepted', { userId }, { planId });
    return plan;
  }

  async regenerateItem(planId: string, itemId: string, userId: string) {
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
    });
    const [candidate] = raw.map((c) => sanitizeRecipeCandidate(c)).filter((r): r is RecipeView => r !== null);
    if (!candidate) {
      throw new BadRequestException('Could not find a replacement meal right now. Please try again.');
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

    await this.analytics.track('plan_ahead_item_regenerated', { userId }, { planId, itemId });

    return this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
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

    return this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
  }

  async removeItem(planId: string, itemId: string, userId: string) {
    const plan = await this.ownedPlan(planId, userId);
    if (!plan.items.some((i) => i.id === itemId)) {
      throw new NotFoundException('Meal plan item not found.');
    }
    await this.prisma.mealPlanItem.delete({ where: { id: itemId } });
    return this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
  }

  async generateShoppingList(planId: string, userId: string) {
    const plan = await this.ownedPlan(planId, userId);
    if (plan.status !== 'accepted') {
      throw new BadRequestException('Accept the plan before generating a shopping list.');
    }

    const existing = await this.prisma.shoppingList.findFirst({
      where: { mealPlanId: planId, userId },
      include: { items: true },
    });
    if (existing) return existing;

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

  private consolidateIngredients(
    items: Array<{ recipe: { ingredients: { name: string; quantity: string | null; unit: string | null }[] } | null }>,
  ) {
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
    };
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
