import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { FoodGoal, PlanPreviewResponse } from '@foodpadi/shared';
import { isShoppingComplete } from '@foodpadi/shared';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { curatedPlanForDays } from '../ai/curated-recipes';
import { goalGuidanceLine } from '../ai/goal-guidance';
import { RecipeView, sanitizeRecipeCandidate } from '../ai/recipe-validation';
import { dropRecipesWithAvoided } from '../../common/avoided-ingredients';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { RequestActor } from '../auth/guest-or-auth.guard';
import { EntitlementService } from '../billing/entitlement.service';
import { CookingInsightsService } from '../feedback/cooking-insights.service';
import { AddShoppingListItemDto, UpdateShoppingListItemDto } from './dto/shopping-list-item.dto';
import { GeneratePlanDto, PlanScope } from './dto/generate-plan.dto';
import { UpdateMealPlanItemDto } from './dto/update-meal-plan-item.dto';
import { UpdatePlanDefaultsDto } from './dto/update-plan-defaults.dto';
import { RegeneratePlanItemDto } from './dto/regenerate-plan-item.dto';
import { GenerateShoppingListDto } from './dto/generate-shopping-list.dto';
import { CreateStandaloneShoppingListDto } from './dto/create-standalone-shopping-list.dto';

const SCOPE_DAYS: Record<Exclude<PlanScope, 'custom'>, number> = {
  today: 1,
  tomorrow: 1,
  '3day': 3,
  week: 7,
};

const MAX_PLAN_DAYS = 14;

// Plan Ahead is Premium-only past a single day (user instruction 2026-09-12):
// guest and trial can plan 'today'/'tomorrow' — the two 1-day scopes — but
// '3day'/'week'/'custom' need a paid subscription. Checked server-side in
// generate() (the authoritative gate) and mirrored client-side (web's
// PlanScopeForm, mobile's PlanAheadScreen) purely for UX — a request that
// skips the UI and hits the API directly still gets rejected here.
const SCOPES_REQUIRING_PREMIUM: PlanScope[] = ['3day', 'week', 'custom'];
// Anonymous guests have no entitlement row at all — same 1-day cap as a
// registered non-paid user, enforced in preview() below.
const GUEST_MAX_PREVIEW_DAYS = 1;

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
    private readonly aiAccess: AiAccessService,
    private readonly entitlements: EntitlementService,
    private readonly cookingInsights: CookingInsightsService,
  ) {}

  // Cross-customer "what other cooks reported" signal for the AI prompt. A
  // named focus (a specific dish) resolves to the per-dish aggregate; with no
  // focus (a whole-plan generation) falls back to the dish-agnostic aggregate
  // across all recent cooks. Both are already null-safe internally — this
  // never throws and never blocks a plan from generating.
  private async resolveCommunityNotes(focus?: string): Promise<string | undefined> {
    const note = focus?.trim()
      ? await this.cookingInsights.getPromptNote(focus)
      : await this.cookingInsights.getGeneralGuidance();
    return note ?? undefined;
  }

  // Favourite cuisines, avoided ingredients and food goals for one user,
  // shaped for ClaudeService.generatePlanMeals. Same three signals Cook Today
  // and Eat Now personalise from — pulled together here so generate(),
  // regenerateItem() and regeneratePlan() all steer identically.
  private async loadPersonalisation(
    userId: string,
  ): Promise<{ favouriteCuisines: string[]; avoidedIngredients: string[]; goalGuidance?: string }> {
    const [preferences, avoided, goals] = await Promise.all([
      this.prisma.foodPreference.findMany({ where: { userId, deletedAt: null, cuisine: { not: null } } }),
      this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.foodGoal.findMany({ where: { userId, isActive: true } }),
    ]);

    const personalNote = goals.find((g) => g.goalType === 'personal')?.note ?? null;

    return {
      favouriteCuisines: preferences.map((p) => p.cuisine).filter((c): c is string => !!c),
      avoidedIngredients: avoided.map((a) => a.ingredientName),
      goalGuidance:
        goalGuidanceLine({ goalTypes: goals.map((g) => g.goalType as FoodGoal), personalNote }) ?? undefined,
    };
  }

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

  // Highest day-count preview() will honour for this caller — 1 for an
  // anonymous guest or a registered non-paid user (trial/lapsed), 7 for a
  // Premium subscriber. `GuestOrAuthGuard` lets either actor type reach
  // preview(), even though today's clients only ever call it while signed
  // out (see app/plan/page.tsx) — this covers both regardless of who calls it.
  private async maxPreviewDays(actor: RequestActor): Promise<number> {
    if (actor.type === 'guest') return GUEST_MAX_PREVIEW_DAYS;
    const entitlement = await this.entitlements.getUserEntitlement(actor.userId);
    return entitlement === 'paid' ? 7 : GUEST_MAX_PREVIEW_DAYS;
  }

  /**
   * Guest / signed-out Plan Ahead preview (guest-mode brief §8) — a few
   * curated dinner ideas for the chosen number of days. No AI (curated pool,
   * never ClaudeService), nothing persisted. Building a real saved plan with
   * reminders and per-day edits still needs an account (generate() above).
   */
  async preview(days: number, actor: RequestActor): Promise<PlanPreviewResponse> {
    const maxDays = await this.maxPreviewDays(actor);
    const clamped = Math.min(Math.max(1, Math.round(days || 3)), maxDays);
    const recipes = curatedPlanForDays(clamped)
      .map((candidate) => sanitizeRecipeCandidate(candidate))
      .filter((recipe): recipe is RecipeView => recipe !== null);

    await this.analytics.track(
      'plan_preview_generated',
      actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId },
      { days: clamped, resultCount: recipes.length, guest: actor.type === 'guest' },
    );

    return { days: recipes.map((recipe, dayIndex) => ({ dayIndex, recipe })) };
  }

  async generate(dto: GeneratePlanDto, userId: string) {
    if (SCOPES_REQUIRING_PREMIUM.includes(dto.scope)) {
      const entitlement = await this.entitlements.getUserEntitlement(userId);
      if (entitlement !== 'paid') {
        throw new HttpException(
          {
            message:
              'Planning more than one day ahead is a FoodPadi Premium feature. Upgrade to unlock the full week and custom-length plans.',
            code: 'PLAN_SCOPE_REQUIRES_PREMIUM',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }
    await this.aiAccess.assertCanUseAi(userId, 'plan_ahead_generate');
    const days = this.resolveDayCount(dto);

    const personalisation = await this.loadPersonalisation(userId);
    const communityNotes = await this.resolveCommunityNotes(dto.prompt);

    const raw = await this.claude.generatePlanMeals({
      days,
      budgetPence: dto.budgetPence,
      ...personalisation,
      allowGenericFallback: true,
      // Reuses the same free-text `focus` field the single-day "replace with
      // something specific" flow already sends — the prompt-building logic
      // in generatePlanMeals already phrases it correctly for either one day
      // ("this day") or several ("these days").
      focus: dto.prompt,
      communityNotes,
    });

    const sanitized = raw
      .map((candidate) => sanitizeRecipeCandidate(candidate))
      .filter((recipe): recipe is RecipeView => recipe !== null);
    // The prompt already told Claude to avoid these — this is the hard
    // backstop for when a multi-day generation lets one slip through
    // anyway, same guarantee Cook Today and Eat Now already give.
    const validated = dropRecipesWithAvoided(sanitized, personalisation.avoidedIngredients);

    if (validated.length === 0) {
      throw new BadRequestException(
        sanitized.length === 0
          ? 'Could not generate a meal plan right now. Please try again.'
          : "Everything FoodPadi came up with matched something you've asked to avoid. Please try again.",
      );
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

    await this.analytics.track(
      'plan_ahead_generated',
      { userId },
      { scope: dto.scope, days: validated.length, hasPrompt: !!dto.prompt?.trim() },
    );

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
    await this.aiAccess.assertCanUseAi(userId, 'plan_ahead_regenerate_item');
    const plan = await this.ownedPlan(planId, userId);
    const item = plan.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException('Meal plan item not found.');
    }

    const personalisation = await this.loadPersonalisation(userId);
    const communityNotes = await this.resolveCommunityNotes(dto.focus);

    const raw = await this.claude.generatePlanMeals({
      days: 1,
      ...personalisation,
      focus: dto.focus,
      communityNotes,
    });
    const sanitized = raw.map((c) => sanitizeRecipeCandidate(c)).filter((r): r is RecipeView => r !== null);
    // Same hard backstop as generate()/regeneratePlan() — don't let a
    // single-day replacement hand back something the user said to avoid.
    const [candidate] = dropRecipesWithAvoided(sanitized, personalisation.avoidedIngredients);
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
    await this.aiAccess.assertCanUseAi(userId, 'plan_ahead_regenerate_plan');
    const plan = await this.ownedPlan(planId, userId);
    const days = Math.min(daysBetweenInclusive(plan.startDate, plan.endDate), MAX_PLAN_DAYS);

    const personalisation = await this.loadPersonalisation(userId);
    const communityNotes = await this.resolveCommunityNotes();

    const raw = await this.claude.generatePlanMeals({
      days,
      budgetPence: plan.budgetPence ?? undefined,
      ...personalisation,
      allowGenericFallback: true,
      communityNotes,
    });

    const sanitized = raw
      .map((candidate) => sanitizeRecipeCandidate(candidate))
      .filter((recipe): recipe is RecipeView => recipe !== null);
    const validated = dropRecipesWithAvoided(sanitized, personalisation.avoidedIngredients);

    if (validated.length === 0) {
      throw new BadRequestException(
        sanitized.length === 0
          ? 'Could not rebuild the plan right now. Please try again.'
          : "Everything FoodPadi came up with matched something you've asked to avoid. Please try again.",
      );
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
        ...(dto.reminderOffsetMinutes !== undefined ? { reminderOffsetMinutes: dto.reminderOffsetMinutes } : {}),
      },
    });

    await this.analytics.track('plan_ahead_item_updated', { userId }, {
      planId,
      itemId,
      mealChoice: dto.mealChoice,
      hasTime: dto.plannedTime !== undefined ? dto.plannedTime !== null : undefined,
      hasReminderOffsetOverride:
        dto.reminderOffsetMinutes !== undefined ? dto.reminderOffsetMinutes !== null : undefined,
    });

    const fresh = await this.prisma.mealPlan.findUniqueOrThrow({ where: { id: planId }, include: this.planInclude() });
    return this.serialize(fresh);
  }

  /**
   * Sets the plan-wide default eating time and/or reminder lead time — "set
   * once, applies to every day that hasn't been individually overridden".
   * Deliberately never touches MealPlanItem rows: see UpdatePlanDefaultsDto's
   * own comment for why that's what makes this safe to change repeatedly
   * without ever clobbering a day the user explicitly customised.
   */
  async updatePlanDefaults(planId: string, userId: string, dto: UpdatePlanDefaultsDto) {
    await this.ownedPlan(planId, userId); // ownership check; throws if not found/owned

    await this.prisma.mealPlan.update({
      where: { id: planId },
      data: {
        ...(dto.defaultMealTime !== undefined ? { defaultMealTime: dto.defaultMealTime } : {}),
        ...(dto.defaultReminderOffsetMinutes !== undefined
          ? { defaultReminderOffsetMinutes: dto.defaultReminderOffsetMinutes }
          : {}),
      },
    });

    await this.analytics.track('plan_ahead_defaults_updated', { userId }, {
      planId,
      hasDefaultTime: dto.defaultMealTime !== undefined ? dto.defaultMealTime !== null : undefined,
      defaultReminderOffsetMinutes: dto.defaultReminderOffsetMinutes,
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

  /**
   * A shopping list created directly from an ingredient list rather than
   * from an accepted plan — e.g. Cook Today's fridge-check "you need to buy"
   * set (FridgeCheck.tsx). Same ShoppingList/ShoppingListItem model and the
   * same shape generateShoppingList's own `create` call above already uses,
   * just without the plan/accepted-status requirement — mealPlanId is null,
   * which the shared ShoppingListView type and the shopping-list web page
   * already anticipate ("Null for a standalone list").
   */
  async createStandaloneShoppingList(userId: string, dto: CreateStandaloneShoppingListDto) {
    // If this list is being created inside a Cooking Journey's fridge-check,
    // validate that journey up front so we never leave an orphan list.
    let linkJourneyId: string | null = null;
    if (dto.cookingJourneyId) {
      const journey = await this.prisma.cookingJourney.findUnique({
        where: { id: dto.cookingJourneyId },
        select: { userId: true, status: true, stage: true },
      });
      if (!journey || journey.userId !== userId) {
        throw new NotFoundException('Cooking journey not found.');
      }
      if (journey.status === 'active') linkJourneyId = dto.cookingJourneyId;
    }

    const list = await this.prisma.shoppingList.create({
      data: {
        userId,
        mealPlanId: null,
        items: {
          create: dto.items.map((item) => ({
            ingredientName: item.ingredientName,
            quantity: item.quantity,
            unit: item.unit,
            addedManually: true,
          })),
        },
      },
      include: { items: true, cookingJourney: true },
    });

    if (linkJourneyId) {
      await this.prisma.cookingJourney.update({
        where: { id: linkJourneyId },
        data: { shoppingListId: list.id, stage: 'shopping', lastActivityAt: new Date() },
      });
      await this.analytics.track('cooking_journey_stage_changed', { userId }, {
        journeyId: linkJourneyId,
        from: 'ingredient_check',
        to: 'shopping',
      });
      // Re-read so the response carries the freshly linked journey.
      const relinked = await this.prisma.shoppingList.findUnique({
        where: { id: list.id },
        include: { items: true, cookingJourney: true },
      });
      await this.analytics.track('shopping_list_generated', { userId }, {
        planId: null,
        itemCount: dto.items.length,
        source: 'standalone',
        linkedToJourney: true,
      });
      return this.serializeShoppingList(relinked ?? list);
    }

    await this.analytics.track('shopping_list_generated', { userId }, {
      planId: null,
      itemCount: dto.items.length,
      source: 'standalone',
    });

    return this.serializeShoppingList(list);
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
    const list = await this.prisma.shoppingList.findUnique({
      where: { id: listId },
      include: { items: true, cookingJourney: true },
    });
    if (!list || list.userId !== userId) {
      throw new NotFoundException('Shopping list not found.');
    }
    return this.serializeShoppingList(list);
  }

  async updateShoppingListItem(listId: string, itemId: string, userId: string, dto: UpdateShoppingListItemDto) {
    await this.getShoppingList(listId, userId); // ownership check
    const updated = await this.prisma.shoppingListItem.update({ where: { id: itemId }, data: dto });
    // Keep a linked Cooking Journey in step: ticking the last item off moves
    // it to "ready to cook", un-ticking one moves it back to "shopping".
    if (dto.checked !== undefined) {
      await this.syncLinkedJourneyStage(listId, userId);
    }
    return updated;
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
    await this.syncLinkedJourneyStage(listId, userId);
  }

  // Shapes a ShoppingList row (+ its optional linked CookingJourney) into the
  // ShoppingListView the clients expect. `cookingJourney` is populated only
  // for a list that belongs to an active journey — plan-derived and plain
  // standalone lists get null, so the shopping screen's "← Back to Cooking"
  // header only shows in a real cook (brief §23).
  private serializeShoppingList(list: {
    id: string;
    status: string;
    mealPlanId: string | null;
    items: Array<{
      id: string;
      ingredientName: string;
      quantity: string | null;
      unit: string | null;
      checked: boolean;
      addedManually: boolean;
    }>;
    cookingJourney?: { id: string; stage: string; status: string; recipeSnapshot: unknown } | null;
  }) {
    const journey =
      list.cookingJourney && list.cookingJourney.status === 'active' ? list.cookingJourney : null;
    const recipeTitle =
      (journey?.recipeSnapshot as { title?: string } | null)?.title ?? 'your recipe';

    return {
      id: list.id,
      status: list.status,
      mealPlanId: list.mealPlanId,
      cookingJourney: journey ? { id: journey.id, recipeTitle, stage: journey.stage } : null,
      items: list.items.map((i) => ({
        id: i.id,
        ingredientName: i.ingredientName,
        quantity: i.quantity,
        unit: i.unit,
        checked: i.checked,
        addedManually: i.addedManually,
      })),
    };
  }

  // Ticking a linked journey's shopping list toward / away from complete moves
  // that journey between the "shopping" and "ready_to_cook" stages, so the
  // Cook landing card and the shopping screen agree without an extra client
  // call. Only ever touches an ACTIVE journey sitting in one of those two
  // stages.
  private async syncLinkedJourneyStage(listId: string, userId: string): Promise<void> {
    const journey = await this.prisma.cookingJourney.findUnique({
      where: { shoppingListId: listId },
      select: { id: true, stage: true, status: true },
    });
    if (!journey || journey.status !== 'active') return;
    if (journey.stage !== 'shopping' && journey.stage !== 'ready_to_cook') return;

    const items = await this.prisma.shoppingListItem.findMany({
      where: { shoppingListId: listId },
      select: { checked: true },
    });
    const nextStage = isShoppingComplete(items) ? 'ready_to_cook' : 'shopping';
    if (nextStage === journey.stage) return;

    await this.prisma.cookingJourney.update({
      where: { id: journey.id },
      data: { stage: nextStage, lastActivityAt: new Date() },
    });
    await this.analytics.track(
      nextStage === 'ready_to_cook' ? 'shopping_completed' : 'cooking_journey_stage_changed',
      { userId },
      { journeyId: journey.id, from: journey.stage, to: nextStage },
    );
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
