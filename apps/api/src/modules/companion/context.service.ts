import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatternService } from './pattern.service';
import type { FoodPattern } from '@prisma/client';

const DECISION_EVENT_TYPES = ['decide_options_generated', 'cook_today_recipes_generated'];
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const UPCOMING_WINDOW_MINUTES = 90;

export interface TodayPlanItem {
  id: string;
  mealPlanId: string;
  recipeTitle: string | null;
  mealChoice: string;
  plannedTime: string | null;
  /** Minutes from `now` until `plannedTime` today, or null if no time is set. */
  minutesUntil: number | null;
}

export interface FoodContext {
  now: Date;
  dayOfWeek: number;
  weekdayKey: string;
  weekdayGroup: 'weekday' | 'weekend';
  /** Has the user already asked "what should I eat" (Decide/Cook Today) today? */
  decidedToday: boolean;
  todayPlanItems: TodayPlanItem[];
  /** The one today-item, if any, whose plannedTime falls within the next 90 min. */
  upcomingPlanItem: TodayPlanItem | null;
  pantryItemNames: string[];
  favouriteCuisines: string[];
  avoidedIngredients: string[];
  activeGoalTypes: string[];
  patterns: FoodPattern[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function minutesUntilPlannedTime(now: Date, plannedTime: string | null): number | null {
  if (!plannedTime) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(plannedTime);
  if (!match) return null;
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

/**
 * Aggregates everything the Companion engine needs into one deterministic
 * read (Memory & Companion brief §7) — pure aggregation of data FoodPadi
 * already has, no AI call. Every field here is a food-decision fact: no
 * location, no unrelated activity (brief §15).
 */
@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patterns: PatternService,
  ) {}

  async buildContext(userId: string, now: Date = new Date()): Promise<FoodContext> {
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [decidedTodayEvent, planItems, pantryItems, preferences, avoided, goals, patterns] = await Promise.all([
      this.prisma.foodEvent.findFirst({
        where: { userId, eventType: { in: DECISION_EVENT_TYPES }, occurredAt: { gte: todayStart } },
        select: { id: true },
      }),
      this.prisma.mealPlanItem.findMany({
        where: { mealPlan: { userId, deletedAt: null }, plannedDate: { gte: todayStart, lte: todayEnd } },
        include: { recipe: { select: { title: true } } },
      }),
      this.prisma.pantryItem.findMany({
        where: { userId, deletedAt: null },
        select: { name: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.foodPreference.findMany({ where: { userId, deletedAt: null, cuisine: { not: null } } }),
      this.prisma.avoidedIngredient.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.foodGoal.findMany({ where: { userId, isActive: true } }),
      this.patterns.getActivePatterns(userId),
    ]);

    const todayPlanItems: TodayPlanItem[] = planItems.map((item) => ({
      id: item.id,
      mealPlanId: item.mealPlanId,
      recipeTitle: item.recipe?.title ?? null,
      mealChoice: item.mealChoice,
      plannedTime: item.plannedTime,
      minutesUntil: minutesUntilPlannedTime(now, item.plannedTime),
    }));

    const upcomingPlanItem =
      todayPlanItems.find((i) => i.minutesUntil !== null && i.minutesUntil >= 0 && i.minutesUntil <= UPCOMING_WINDOW_MINUTES) ??
      null;

    const dayOfWeek = now.getDay();

    return {
      now,
      dayOfWeek,
      weekdayKey: WEEKDAY_KEYS[dayOfWeek],
      weekdayGroup: dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'weekday',
      decidedToday: !!decidedTodayEvent,
      todayPlanItems,
      upcomingPlanItem,
      pantryItemNames: [...new Set(pantryItems.map((p) => p.name))],
      favouriteCuisines: [
        ...new Set(preferences.map((p) => p.cuisine).filter((c): c is string => !!c)),
      ],
      avoidedIngredients: avoided.map((a) => a.ingredientName),
      activeGoalTypes: goals.map((g) => g.goalType),
      patterns,
    };
  }
}
