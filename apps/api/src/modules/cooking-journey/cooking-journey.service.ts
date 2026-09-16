import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CookingJourney, Recipe, RecipeIngredient } from '@prisma/client';
import {
  computeTimerRemaining,
  isShoppingComplete,
  migrateIngredientCheckState,
  resolveJourneyDestination,
  summariseIngredientCheck,
  type CookingJourneyStage,
  type CookingJourneyStatus,
  type CookingJourneyView,
  type CookingTimerState,
  type CookingTimerStatus,
  type RecipeView,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CookTodayService } from '../cook-today/cook-today.service';
import { CreateCookingJourneyDto } from './dto/create-cooking-journey.dto';
import { UpdateCookingJourneyDto } from './dto/update-cooking-journey.dto';
import { UpdateCookingJourneyTimerDto } from './dto/update-cooking-journey-timer.dto';

const AWAY_RESUMED_MS = 30 * 60 * 1000;

type RecipeWithIngredients = Recipe & { ingredients: RecipeIngredient[] };

/** Prisma Recipe row → the RecipeView shape the client renders. Recipes are
 * never edited in place in this codebase, so this stays a faithful copy. */
function recipeRowToView(row: RecipeWithIngredients): RecipeView {
  return {
    title: row.title,
    cookTimeMinutes: row.cookTimeMinutes,
    servings: row.servings,
    cuisine: row.cuisine,
    ingredients: row.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
    steps: (row.steps as string[]) ?? [],
  };
}

function timerStateOf(journey: CookingJourney): CookingTimerState {
  return {
    status: journey.timerStatus as CookingTimerStatus | null,
    durationSeconds: journey.timerDurationSeconds,
    endsAt: journey.timerEndsAt ? journey.timerEndsAt.toISOString() : null,
    remainingSeconds: journey.timerRemainingSeconds,
  };
}

/**
 * The persistent, resumable cooking journey (docs cooking-journey brief).
 * One ACTIVE journey per user; the row — not React/session state — is the
 * source of truth, so navigating away, closing the app or logging out never
 * loses the cook. The client state machines (CookTodayForm / CookingSession)
 * still drive the UI; this service mirrors their position.
 *
 * Reuses the existing engines rather than duplicating them: CookTodayService
 * .save persists a fresh Cook Today result, CookTodayService.markCooked
 * stamps Recipe.lastCookedAt on completion (unchanged behaviour), the
 * shopping list lives in PlanAheadService, ratings stay on FeedbackService.
 * Deterministic — no AI, no LLM call anywhere here.
 */
@Injectable()
export class CookingJourneyService {
  private readonly logger = new Logger(CookingJourneyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly cookToday: CookTodayService,
  ) {}

  async getActive(userId: string): Promise<CookingJourneyView | null> {
    const journey = await this.findActive(userId);
    if (!journey) return null;

    const view = await this.toView(journey);

    // A "resumed" signal for the Companion friction detectors — only when the
    // user has genuinely been away, so a page refresh mid-cook doesn't spam it.
    const awayMs = Date.now() - journey.lastActivityAt.getTime();
    if (awayMs > AWAY_RESUMED_MS) {
      await this.analytics.track('cooking_journey_resumed', { userId }, {
        journeyId: journey.id,
        stage: journey.stage,
        awayMinutes: Math.round(awayMs / 60_000),
      });
      // Extra signal: the user is coming back to an unfinished fridge review —
      // exactly the case the persistence fix is for (brief §32).
      if (view.stage === 'ingredient_check' && view.ingredientState) {
        await this.analytics.track('ingredient_review_resumed', { userId }, {
          journeyId: journey.id,
          subStage: view.ingredientState.subStage,
          ...summariseIngredientCheck(view.ingredientState),
        });
      }
    }
    return view;
  }

  async create(userId: string, dto: CreateCookingJourneyDto): Promise<CookingJourneyView> {
    if (!dto.recipeId && !dto.recipe && !dto.mealPlanItemId) {
      throw new BadRequestException('Provide a recipe, a recipeId, or a mealPlanItemId to start cooking.');
    }

    const existing = await this.findActive(userId);
    if (existing && !dto.replace) {
      throw new ConflictException({
        code: 'ACTIVE_JOURNEY_EXISTS',
        message: 'You already have an unfinished cooking journey. Starting another will replace it.',
        journey: await this.toView(existing),
      });
    }

    const { recipeId, snapshot } = await this.resolveRecipe(userId, dto);

    const journey = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.cookingJourney.update({
          where: { id: existing.id },
          data: { status: 'cancelled', lastActivityAt: new Date() },
        });
      }
      return tx.cookingJourney.create({
        data: {
          userId,
          recipeId,
          recipeSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          stage: 'recipe_selected',
          status: 'active',
          mealPlanItemId: dto.mealPlanItemId ?? null,
        },
      });
    });

    if (existing) {
      await this.analytics.track('cooking_journey_abandoned', { userId }, {
        journeyId: existing.id,
        reason: 'replaced',
        stage: existing.stage,
      });
    }
    await this.analytics.track('cooking_journey_started', { userId }, {
      journeyId: journey.id,
      recipeId,
      fromPlan: !!dto.mealPlanItemId,
    });

    return this.toView(journey);
  }

  async update(userId: string, id: string, dto: UpdateCookingJourneyDto): Promise<CookingJourneyView> {
    const journey = await this.loadActiveOwned(id, userId);

    const data: Prisma.CookingJourneyUpdateInput = { lastActivityAt: new Date() };
    const afterCommit: Array<() => Promise<unknown>> = [];

    if (dto.stage && dto.stage !== journey.stage) {
      data.stage = dto.stage;
      if (dto.stage === 'cooking' && !journey.cookingStartedAt) {
        data.cookingStartedAt = new Date();
      }
      afterCommit.push(() =>
        this.analytics.track('cooking_journey_stage_changed', { userId }, {
          journeyId: id,
          from: journey.stage,
          to: dto.stage,
        }),
      );
    }

    if (dto.currentStep !== undefined && dto.currentStep !== journey.currentStep) {
      data.currentStep = dto.currentStep;
      if (dto.currentStep > journey.currentStep) {
        afterCommit.push(() =>
          this.analytics.track('cooking_step_completed', { userId }, {
            journeyId: id,
            step: journey.currentStep,
            currentStep: dto.currentStep,
          }),
        );
      }
    }

    if (dto.ingredientState !== undefined) {
      // Stored verbatim as JSON — the shared migrateIngredientCheckState()
      // normalises it on read. This is the fix: the whole fridge-scan session
      // (scan results, keep/reject decisions, have/need, ticks) survives, not
      // just a {have,need} name projection.
      data.ingredientStatus = dto.ingredientState as unknown as Prisma.InputJsonValue;
      const summary = summariseIngredientCheck(migrateIngredientCheckState(dto.ingredientState)!);
      afterCommit.push(() =>
        this.analytics.track('ingredient_review_saved', { userId }, {
          journeyId: id,
          subStage: dto.ingredientState!.subStage,
          kept: summary.kept,
          rejected: summary.rejected,
          haveCount: summary.haveCount,
          needCount: summary.needCount,
          purchasedCount: summary.purchasedCount,
        }),
      );
    }

    if (dto.shoppingListId !== undefined) {
      await this.assertOwnsList(dto.shoppingListId, userId);
      data.shoppingList = { connect: { id: dto.shoppingListId } };
    }

    if (dto.feedbackId !== undefined) {
      data.feedbackId = dto.feedbackId;
    }

    if (dto.status === 'completed') {
      data.status = 'completed';
      data.cookingCompletedAt = journey.cookingCompletedAt ?? new Date();
    } else if (dto.status === 'cancelled') {
      data.status = 'cancelled';
      afterCommit.push(() =>
        this.analytics.track('cooking_journey_abandoned', { userId }, {
          journeyId: id,
          reason: 'user_cancelled',
          stage: journey.stage,
        }),
      );
    }

    const updated = await this.prisma.cookingJourney.update({ where: { id }, data });
    for (const run of afterCommit) await run();
    return this.toView(updated);
  }

  async updateTimer(userId: string, id: string, dto: UpdateCookingJourneyTimerDto): Promise<CookingJourneyView> {
    const journey = await this.loadActiveOwned(id, userId);
    const now = new Date();
    let data: Prisma.CookingJourneyUpdateInput = { lastActivityAt: now };

    switch (dto.action) {
      case 'start': {
        if (!dto.durationSeconds) throw new BadRequestException('durationSeconds is required to start a timer.');
        data = {
          ...data,
          timerStatus: 'running',
          timerDurationSeconds: dto.durationSeconds,
          timerEndsAt: new Date(now.getTime() + dto.durationSeconds * 1000),
          timerRemainingSeconds: null,
        };
        break;
      }
      case 'reset': {
        if (!dto.durationSeconds) throw new BadRequestException('durationSeconds is required to reset a timer.');
        data = {
          ...data,
          timerStatus: null,
          timerDurationSeconds: dto.durationSeconds,
          timerEndsAt: null,
          timerRemainingSeconds: dto.durationSeconds,
        };
        break;
      }
      case 'pause': {
        data = {
          ...data,
          timerStatus: 'paused',
          timerEndsAt: null,
          timerRemainingSeconds: computeTimerRemaining(timerStateOf(journey), now),
        };
        break;
      }
      case 'resume': {
        const remaining = journey.timerRemainingSeconds ?? journey.timerDurationSeconds ?? 0;
        data = {
          ...data,
          timerStatus: 'running',
          timerEndsAt: new Date(now.getTime() + remaining * 1000),
          timerRemainingSeconds: null,
        };
        break;
      }
      case 'complete': {
        data = { ...data, timerStatus: 'done', timerEndsAt: null, timerRemainingSeconds: 0 };
        break;
      }
    }

    const updated = await this.prisma.cookingJourney.update({ where: { id }, data });
    return this.toView(updated);
  }

  async complete(userId: string, id: string): Promise<CookingJourneyView> {
    const journey = await this.loadActiveOwned(id, userId);

    const updated = await this.prisma.cookingJourney.update({
      where: { id },
      data: {
        stage: 'feedback_pending',
        cookingCompletedAt: journey.cookingCompletedAt ?? new Date(),
        lastActivityAt: new Date(),
        timerStatus: journey.timerStatus === 'running' ? 'done' : journey.timerStatus,
        timerEndsAt: null,
      },
    });

    // Stamp Recipe.lastCookedAt through the existing engine — same call the
    // client used to make directly, behaviour unchanged. Non-fatal.
    if (journey.recipeId) {
      try {
        await this.cookToday.markCooked(journey.recipeId, userId);
      } catch (err) {
        this.logger.warn(`markCooked after journey ${id} failed: ${(err as Error).message}`);
      }
    }

    const elapsedMinutes = journey.cookingStartedAt
      ? Math.round((Date.now() - journey.cookingStartedAt.getTime()) / 60_000)
      : null;
    await this.analytics.track('cooking_journey_completed', { userId }, {
      journeyId: id,
      recipeId: journey.recipeId,
      elapsedMinutes,
    });

    return this.toView(updated);
  }

  async cancel(userId: string, id: string): Promise<void> {
    const journey = await this.loadActiveOwned(id, userId);
    await this.prisma.cookingJourney.update({
      where: { id },
      data: { status: 'cancelled', lastActivityAt: new Date() },
    });
    await this.analytics.track('cooking_journey_abandoned', { userId }, {
      journeyId: id,
      reason: 'user_cancelled',
      stage: journey.stage,
    });
  }

  // --- internals ----------------------------------------------------------

  private findActive(userId: string) {
    return this.prisma.cookingJourney.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async loadActiveOwned(id: string, userId: string): Promise<CookingJourney> {
    const journey = await this.prisma.cookingJourney.findUnique({ where: { id } });
    if (!journey) throw new NotFoundException('Cooking journey not found.');
    if (journey.userId !== userId) throw new ForbiddenException();
    if (journey.status !== 'active') {
      throw new BadRequestException('This cooking journey has already finished.');
    }
    return journey;
  }

  private async assertOwnsList(listId: string, userId: string): Promise<void> {
    const list = await this.prisma.shoppingList.findUnique({ where: { id: listId }, select: { userId: true } });
    if (!list || list.userId !== userId) throw new NotFoundException('Shopping list not found.');
  }

  private async resolveRecipe(
    userId: string,
    dto: CreateCookingJourneyDto,
  ): Promise<{ recipeId: string; snapshot: RecipeView }> {
    if (dto.recipeId) {
      const row = await this.prisma.recipe.findFirst({
        where: { id: dto.recipeId, deletedAt: null },
        include: { ingredients: true },
      });
      if (!row) throw new NotFoundException('Recipe not found.');
      if (row.createdByUserId && row.createdByUserId !== userId) throw new ForbiddenException();
      return { recipeId: row.id, snapshot: recipeRowToView(row) };
    }

    if (dto.recipe) {
      const saved = await this.cookToday.save(
        {
          title: dto.recipe.title,
          cookTimeMinutes: dto.recipe.cookTimeMinutes,
          servings: dto.recipe.servings,
          cuisine: dto.recipe.cuisine ?? undefined,
          ingredients: dto.recipe.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity ?? undefined,
            unit: i.unit ?? undefined,
          })),
          steps: dto.recipe.steps,
        },
        userId,
      );
      return { recipeId: saved.id, snapshot: recipeRowToView(saved as RecipeWithIngredients) };
    }

    // mealPlanItemId path — cook a planned meal (brief §22).
    const item = await this.prisma.mealPlanItem.findUnique({
      where: { id: dto.mealPlanItemId },
      include: { mealPlan: { select: { userId: true, deletedAt: true } }, recipe: { include: { ingredients: true } } },
    });
    if (!item || item.mealPlan.deletedAt || item.mealPlan.userId !== userId) {
      throw new NotFoundException('Planned meal not found.');
    }
    if (!item.recipe) throw new BadRequestException('That planned meal has no recipe to cook.');
    return { recipeId: item.recipe.id, snapshot: recipeRowToView(item.recipe) };
  }

  private async toView(journey: CookingJourney): Promise<CookingJourneyView> {
    // Recipe: prefer the live row; fall back to the frozen snapshot only if
    // that row was deleted since the journey started (brief §3).
    let recipe: RecipeView;
    let recipeId: string | null = journey.recipeId;
    if (journey.recipeId) {
      const row = await this.prisma.recipe.findFirst({
        where: { id: journey.recipeId, deletedAt: null },
        include: { ingredients: true },
      });
      if (row) {
        recipe = recipeRowToView(row);
      } else {
        recipe = journey.recipeSnapshot as unknown as RecipeView;
        recipeId = null;
      }
    } else {
      recipe = journey.recipeSnapshot as unknown as RecipeView;
      recipeId = null;
    }

    let shoppingList: CookingJourneyView['shoppingList'] = null;
    let shoppingComplete = false;
    if (journey.shoppingListId) {
      const list = await this.prisma.shoppingList.findUnique({
        where: { id: journey.shoppingListId },
        include: { items: { select: { checked: true } } },
      });
      if (list) {
        shoppingList = {
          id: list.id,
          itemsTotal: list.items.length,
          itemsChecked: list.items.filter((i) => i.checked).length,
        };
        shoppingComplete = isShoppingComplete(list.items);
      }
    }

    const timer = journey.timerStatus
      ? {
          status: journey.timerStatus as CookingTimerStatus,
          durationSeconds: journey.timerDurationSeconds,
          remainingSeconds: computeTimerRemaining(timerStateOf(journey)),
        }
      : null;

    const stage = journey.stage as CookingJourneyStage;

    return {
      id: journey.id,
      stage,
      status: journey.status as CookingJourneyStatus,
      currentStep: journey.currentStep,
      recipe,
      recipeId,
      shoppingList,
      // Never hand back the raw column — migrateIngredientCheckState upgrades a
      // legacy {have,need} row and coerces bad fields, so the client always
      // gets a clean v2 state (or null when no check was started).
      ingredientState: migrateIngredientCheckState(journey.ingredientStatus),
      timer,
      mealPlanItemId: journey.mealPlanItemId,
      destination: resolveJourneyDestination({ stage, shoppingComplete }),
      lastActivityAt: journey.lastActivityAt.toISOString(),
      updatedAt: journey.updatedAt.toISOString(),
    };
  }
}
