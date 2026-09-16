import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementService } from '../billing/entitlement.service';

/**
 * Deterministic behavioural-pattern detection (Memory & Companion brief §5).
 * Every function here is pure — it takes already-fetched rows and returns
 * candidate patterns — so the detection logic is unit-testable with plain
 * arrays and no database. PatternService (below) is the only thing that
 * talks to Prisma.
 *
 * Deliberately food-decision facts only (brief §15): every input here is
 * something FoodPadi itself already recorded when the user made a food
 * decision — never location, contacts, unrelated app activity, or anything
 * inferred beyond what's on screen.
 *
 * Time note: buckets by the API server's local clock, not the device's —
 * an acceptable MVP simplification for a single-region UK product (brief
 * §17 "do not overengineer"); a future pass could take a client-reported
 * timezone offset per event instead.
 */

export const PATTERN_TYPES = [
  'meal_time',
  'day_routine',
  'meal_repetition',
  'cuisine_frequency',
  'cook_duration',
  'budget_range',
  'pantry_ingredient',
  'recipe_feedback',
  'cuisine_feedback',
  'plan_satisfaction',
] as const;
export type PatternType = (typeof PATTERN_TYPES)[number];

export interface PatternCandidate {
  patternType: PatternType;
  patternKey: string;
  patternValue: string;
  evidenceCount: number;
  firstObservedAt: Date;
  lastObservedAt: Date;
}

// Evidence thresholds (brief §5): <2 occurrences is noise, not a pattern.
const MIN_EVIDENCE = 2;
const MIN_EVIDENCE_FIRM = 3; // meal_repetition / cuisine / pantry — a looser bar here reports too much

// Confidence model (brief §5 example: 0.72 @ 8 occurrences). Capped, never 1.0
// — the Companion should never claim total certainty (brief §6).
export function confidenceForEvidence(evidenceCount: number): number {
  if (evidenceCount < MIN_EVIDENCE) return 0;
  if (evidenceCount === 2) return 0.35;
  if (evidenceCount <= 5) return 0.6;
  return Math.min(0.95, 0.85 + (evidenceCount - 6) * 0.02);
}

/** Confidence tier drives the Companion's copy register (brief §6). */
export type ConfidenceTier = 'low' | 'medium' | 'high';
export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.55) return 'medium';
  return 'low';
}

// Decay model (brief §20): unreinforced patterns fade rather than staying
// permanently true. Simple rolling-window decay, not a full time-series model.
export const STALE_AFTER_DAYS = 21;
export const DECAY_FACTOR = 0.85;
export const STALE_FLOOR = 0.2;

export function decayConfidence(
  currentConfidence: number,
  lastObservedAt: Date,
  now: Date,
): { confidence: number; status: 'active' | 'stale' } {
  const daysSince = (now.getTime() - lastObservedAt.getTime()) / 86_400_000;
  if (daysSince < STALE_AFTER_DAYS) {
    return { confidence: currentConfidence, status: currentConfidence < STALE_FLOOR ? 'stale' : 'active' };
  }
  const periods = Math.floor(daysSince / STALE_AFTER_DAYS);
  const decayed = currentConfidence * Math.pow(DECAY_FACTOR, periods);
  return { confidence: decayed, status: decayed < STALE_FLOOR ? 'stale' : 'active' };
}

function minMax(dates: Date[]): { first: Date; last: Date } {
  let first = dates[0];
  let last = dates[0];
  for (const d of dates) {
    if (d < first) first = d;
    if (d > last) last = d;
  }
  return { first, last };
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Rounds a timestamp's time-of-day to the nearest 30 minutes, as "HH:MM". */
function roundToHalfHour(d: Date): string {
  let minutes = (d.getHours() * 60 + d.getMinutes()) % (24 * 60);
  minutes = Math.round(minutes / 30) * 30;
  minutes = minutes % (24 * 60);
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** "Typical weekday/weekend decision window" — brief §5 time pattern. */
export function detectMealTimePatterns(events: { occurredAt: Date }[]): PatternCandidate[] {
  const groups: Record<'weekday' | 'weekend', { at: Date; bucket: string }[]> = { weekday: [], weekend: [] };
  for (const e of events) {
    const group = isWeekend(e.occurredAt) ? 'weekend' : 'weekday';
    groups[group].push({ at: e.occurredAt, bucket: roundToHalfHour(e.occurredAt) });
  }

  const records: PatternCandidate[] = [];
  for (const group of ['weekday', 'weekend'] as const) {
    const items = groups[group];
    if (items.length < MIN_EVIDENCE) continue;

    const byBucket = new Map<string, Date[]>();
    for (const it of items) {
      const list = byBucket.get(it.bucket) ?? [];
      list.push(it.at);
      byBucket.set(it.bucket, list);
    }
    let best: [string, Date[]] | null = null;
    for (const entry of byBucket) {
      if (!best || entry[1].length > best[1].length) best = entry;
    }
    if (best && best[1].length >= MIN_EVIDENCE) {
      const { first, last } = minMax(best[1]);
      records.push({
        patternType: 'meal_time',
        patternKey: `${group}_dinner`,
        patternValue: best[0],
        evidenceCount: best[1].length,
        firstObservedAt: first,
        lastObservedAt: last,
      });
    }
  }
  return records;
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** "Friday usually means Eat Out" — brief §5 day pattern, from MealPlanItem.mealChoice. */
export function detectDayRoutinePatterns(
  items: { plannedDate: Date; mealChoice: string }[],
): PatternCandidate[] {
  const byDay = new Map<number, { plannedDate: Date; mealChoice: string }[]>();
  for (const it of items) {
    const list = byDay.get(it.plannedDate.getDay()) ?? [];
    list.push(it);
    byDay.set(it.plannedDate.getDay(), list);
  }

  const records: PatternCandidate[] = [];
  for (const [day, list] of byDay) {
    if (list.length < MIN_EVIDENCE) continue;
    const eatOut = list.filter((i) => i.mealChoice === 'eat_out');
    const cook = list.filter((i) => i.mealChoice !== 'eat_out');
    const dominant = eatOut.length >= cook.length ? eatOut : cook;
    // A routine needs a clear majority, not a coin flip.
    if (dominant.length / list.length < 0.7) continue;
    const { first, last } = minMax(dominant.map((i) => i.plannedDate));
    records.push({
      patternType: 'day_routine',
      patternKey: WEEKDAY_KEYS[day],
      patternValue: dominant === eatOut ? 'eat_out' : 'cook',
      evidenceCount: dominant.length,
      firstObservedAt: first,
      lastObservedAt: last,
    });
  }
  return records;
}

/** "Frequently chosen meal: X" — brief §5, from a user's own saved Recipe titles. */
export function detectMealRepetitionPatterns(recipes: { title: string; createdAt: Date }[]): PatternCandidate[] {
  const byTitle = new Map<string, Date[]>();
  for (const r of recipes) {
    const key = r.title.trim();
    if (!key) continue;
    const list = byTitle.get(key) ?? [];
    list.push(r.createdAt);
    byTitle.set(key, list);
  }
  const records: PatternCandidate[] = [];
  for (const [title, dates] of byTitle) {
    if (dates.length < MIN_EVIDENCE_FIRM) continue;
    const { first, last } = minMax(dates);
    records.push({
      patternType: 'meal_repetition',
      patternKey: title,
      patternValue: title,
      evidenceCount: dates.length,
      firstObservedAt: first,
      lastObservedAt: last,
    });
  }
  return records;
}

/** "Frequently selected cuisine: X" — brief §5, from the same saved recipes. */
export function detectCuisinePatterns(recipes: { cuisine: string | null; createdAt: Date }[]): PatternCandidate[] {
  const byCuisine = new Map<string, { display: string; dates: Date[] }>();
  for (const r of recipes) {
    const trimmed = r.cuisine?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const entry = byCuisine.get(key) ?? { display: trimmed, dates: [] };
    entry.dates.push(r.createdAt);
    byCuisine.set(key, entry);
  }
  const records: PatternCandidate[] = [];
  for (const [key, { display, dates }] of byCuisine) {
    if (dates.length < MIN_EVIDENCE_FIRM) continue;
    const { first, last } = minMax(dates);
    records.push({
      patternType: 'cuisine_frequency',
      patternKey: key,
      patternValue: display,
      evidenceCount: dates.length,
      firstObservedAt: first,
      lastObservedAt: last,
    });
  }
  return records;
}

const MAX_DURATION_SPREAD_MINUTES = 30;

/** "Typical cooking preference: ~30 minutes" — brief §5, from Cook Today's time limit. */
export function detectCookDurationPattern(events: { occurredAt: Date; timeConstraintMinutes: number }[]): PatternCandidate[] {
  const valid = events.filter((e) => Number.isFinite(e.timeConstraintMinutes) && e.timeConstraintMinutes > 0);
  if (valid.length < MIN_EVIDENCE_FIRM) return [];
  const nums = valid.map((v) => v.timeConstraintMinutes);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  // Not a "typical" duration if the requests are all over the place.
  if (max - min > MAX_DURATION_SPREAD_MINUTES) return [];
  const { first, last } = minMax(valid.map((v) => v.occurredAt));
  return [
    {
      patternType: 'cook_duration',
      patternKey: 'typical',
      patternValue: min === max ? `${min} min` : `${min}-${max} min`,
      evidenceCount: valid.length,
      firstObservedAt: first,
      lastObservedAt: last,
    },
  ];
}

function formatPence(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

const MAX_BUDGET_SPREAD_RATIO = 2.5;

/** "Typical food decision budget: £X-£Y" — brief §5, from Decide's budget field. */
export function detectBudgetPattern(events: { occurredAt: Date; budgetPence: number }[]): PatternCandidate[] {
  const valid = events.filter((e) => Number.isFinite(e.budgetPence) && e.budgetPence > 0);
  if (valid.length < MIN_EVIDENCE_FIRM) return [];
  const nums = valid.map((v) => v.budgetPence);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min > 0 && max / min > MAX_BUDGET_SPREAD_RATIO) return [];
  const { first, last } = minMax(valid.map((v) => v.occurredAt));
  return [
    {
      patternType: 'budget_range',
      patternKey: 'typical',
      patternValue: min === max ? formatPence(min) : `${formatPence(min)}-${formatPence(max)}`,
      evidenceCount: valid.length,
      firstObservedAt: first,
      lastObservedAt: last,
    },
  ];
}

/** "Frequently available ingredient: X" — brief §5, from the user's own pantry entries. */
export function detectPantryPatterns(items: { name: string; createdAt: Date }[]): PatternCandidate[] {
  const byName = new Map<string, Date[]>();
  for (const it of items) {
    const key = it.name.trim().toLowerCase();
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(it.createdAt);
    byName.set(key, list);
  }
  const records: PatternCandidate[] = [];
  for (const [name, dates] of byName) {
    if (dates.length < MIN_EVIDENCE_FIRM) continue;
    const { first, last } = minMax(dates);
    records.push({
      patternType: 'pantry_ingredient',
      patternKey: name,
      patternValue: name,
      evidenceCount: dates.length,
      firstObservedAt: first,
      lastObservedAt: last,
    });
  }
  return records;
}

// Explicit feedback (Feedback & Rating brief §6/§9: "explicit rating >
// completed cooking > repeated selection > opened") is stronger evidence
// than the passive signals the detectors above use. Rather than a second
// confidence system, each feedback row counts as this many "occurrences"
// against the same confidenceForEvidence() curve — one clear rating already
// crosses MIN_EVIDENCE, where one passive view wouldn't.
const FEEDBACK_EVIDENCE_WEIGHT = 2;
const POSITIVE_RATING_FLOOR = 4;
const NEGATIVE_RATING_CEILING = 2;

// A mixed bag of ratings (some love it, some don't) isn't a usable
// preference signal yet — report nothing rather than guess a direction.
function feedbackSentiment(ratings: number[]): 'positive' | 'negative' | 'mixed' {
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  if (avg >= POSITIVE_RATING_FLOOR) return 'positive';
  if (avg <= NEGATIVE_RATING_CEILING) return 'negative';
  return 'mixed';
}

/**
 * "Loved/disliked this recipe" — Feedback brief §4/§9, from FoodFeedback
 * rows with entityType RECIPE. Never hard-excludes on a negative sentiment
 * (only avoided_ingredients does that) — this only ever informs ranking.
 */
export function detectRecipeFeedbackPatterns(
  feedback: { entityId: string; rating: number; createdAt: Date }[],
): PatternCandidate[] {
  const byRecipe = new Map<string, { rating: number; createdAt: Date }[]>();
  for (const f of feedback) {
    const list = byRecipe.get(f.entityId) ?? [];
    list.push(f);
    byRecipe.set(f.entityId, list);
  }
  const records: PatternCandidate[] = [];
  for (const [recipeId, rows] of byRecipe) {
    const sentiment = feedbackSentiment(rows.map((r) => r.rating));
    if (sentiment === 'mixed') continue;
    const { first, last } = minMax(rows.map((r) => r.createdAt));
    records.push({
      patternType: 'recipe_feedback',
      patternKey: recipeId,
      patternValue: sentiment,
      evidenceCount: rows.length * FEEDBACK_EVIDENCE_WEIGHT,
      firstObservedAt: first,
      lastObservedAt: last,
    });
  }
  return records;
}

/**
 * "Loved/disliked this cuisine" — Feedback brief §5 ("repeatedly rates spicy
 * Nigerian meals 4-5 stars" → strengthen the cuisine preference), aggregated
 * from the cuisine of whichever recipes were rated.
 */
export function detectCuisineFeedbackPatterns(
  feedback: { cuisine: string; rating: number; createdAt: Date }[],
): PatternCandidate[] {
  const byCuisine = new Map<string, { display: string; rows: { rating: number; createdAt: Date }[] }>();
  for (const f of feedback) {
    const trimmed = f.cuisine.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const entry = byCuisine.get(key) ?? { display: trimmed, rows: [] };
    entry.rows.push(f);
    byCuisine.set(key, entry);
  }
  const records: PatternCandidate[] = [];
  for (const [key, { display, rows }] of byCuisine) {
    const sentiment = feedbackSentiment(rows.map((r) => r.rating));
    if (sentiment === 'mixed') continue;
    const { first, last } = minMax(rows.map((r) => r.createdAt));
    records.push({
      patternType: 'cuisine_feedback',
      patternKey: key,
      patternValue: `${display}:${sentiment}`,
      evidenceCount: rows.length * FEEDBACK_EVIDENCE_WEIGHT,
      firstObservedAt: first,
      lastObservedAt: last,
    });
  }
  return records;
}

/**
 * Overall Plan Ahead satisfaction — Feedback brief §C/§23, from FoodFeedback
 * rows with entityType PLAN. One rolling signal (not per-plan) since the
 * useful question for ranking future plans is "how has this been going
 * lately", not any single week's score.
 */
export function detectPlanSatisfactionPattern(feedback: { rating: number; createdAt: Date }[]): PatternCandidate[] {
  if (feedback.length === 0) return [];
  const avg = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
  const { first, last } = minMax(feedback.map((f) => f.createdAt));
  return [
    {
      patternType: 'plan_satisfaction',
      patternKey: 'overall',
      patternValue: avg.toFixed(1),
      evidenceCount: feedback.length * FEEDBACK_EVIDENCE_WEIGHT,
      firstObservedAt: first,
      lastObservedAt: last,
    },
  ];
}

const EVENT_LOOKBACK_DAYS = 90;
const RECIPE_LOOKBACK_DAYS = 60;
const DECISION_EVENT_TYPES = ['decide_options_generated', 'cook_today_recipes_generated'];

/**
 * Orchestrates pattern detection against the database and keeps
 * `food_patterns` in sync. Recomputed lazily by CompanionService on every
 * `GET /companion/suggestion` call — no cron, no worker (brief §17/§31): a
 * handful of grouped queries over a capped lookback window is cheap at this
 * data volume.
 */
@Injectable()
export class PatternService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async recompute(userId: string, now: Date = new Date()): Promise<void> {
    // Persistent behavioural memory is a Paid-only capability (Guest/Trial/Paid
    // model): a guest or trial user builds no FoodPattern profile. Existing
    // rows from a past paid period are left in place, just not refreshed.
    if ((await this.entitlements.getUserEntitlement(userId)) !== 'paid') return;

    const eventSince = new Date(now.getTime() - EVENT_LOOKBACK_DAYS * 86_400_000);
    const recipeSince = new Date(now.getTime() - RECIPE_LOOKBACK_DAYS * 86_400_000);

    const [decisionEvents, planItems, recipes, pantryItems, feedback] = await Promise.all([
      this.prisma.foodEvent.findMany({
        where: { userId, eventType: { in: DECISION_EVENT_TYPES }, occurredAt: { gte: eventSince } },
        select: { occurredAt: true, metadata: true },
      }),
      this.prisma.mealPlanItem.findMany({
        where: { mealPlan: { userId, deletedAt: null }, plannedDate: { gte: eventSince } },
        select: { plannedDate: true, mealChoice: true },
      }),
      this.prisma.recipe.findMany({
        where: { createdByUserId: userId, deletedAt: null, createdAt: { gte: recipeSince } },
        select: { title: true, cuisine: true, createdAt: true },
      }),
      this.prisma.pantryItem.findMany({
        where: { userId, deletedAt: null, createdAt: { gte: eventSince } },
        select: { name: true, createdAt: true },
      }),
      this.prisma.foodFeedback.findMany({
        where: { userId, deletedAt: null, createdAt: { gte: eventSince } },
        select: { entityType: true, entityId: true, rating: true, createdAt: true },
      }),
    ]);

    const cookDurationEvents = decisionEvents
      .map((e) => ({ occurredAt: e.occurredAt, timeConstraintMinutes: Number((e.metadata as any)?.timeConstraintMinutes) }))
      .filter((e) => Number.isFinite(e.timeConstraintMinutes));
    const budgetEvents = decisionEvents
      .map((e) => ({ occurredAt: e.occurredAt, budgetPence: Number((e.metadata as any)?.budgetPence) }))
      .filter((e) => Number.isFinite(e.budgetPence));

    // Recipe feedback needs each rated recipe's cuisine for the cuisine
    // detector — FoodFeedback.entityId is a loose polymorphic id (RECIPE |
    // MEAL | PLAN), not a Prisma relation, so this is a small manual join
    // rather than an `include`.
    const recipeFeedback = feedback.filter((f) => f.entityType === 'RECIPE');
    const recipeIds = [...new Set(recipeFeedback.map((f) => f.entityId))];
    const feedbackRecipes = recipeIds.length
      ? await this.prisma.recipe.findMany({ where: { id: { in: recipeIds } }, select: { id: true, cuisine: true } })
      : [];
    const cuisineByRecipeId = new Map(feedbackRecipes.map((r) => [r.id, r.cuisine]));
    const cuisineFeedback = recipeFeedback
      .map((f) => ({ cuisine: cuisineByRecipeId.get(f.entityId), rating: f.rating, createdAt: f.createdAt }))
      .filter((f): f is { cuisine: string; rating: number; createdAt: Date } => !!f.cuisine);
    const planFeedback = feedback.filter((f) => f.entityType === 'PLAN');

    const candidates: PatternCandidate[] = [
      ...detectMealTimePatterns(decisionEvents),
      ...detectDayRoutinePatterns(planItems),
      ...detectMealRepetitionPatterns(recipes),
      ...detectCuisinePatterns(recipes),
      ...detectCookDurationPattern(cookDurationEvents),
      ...detectBudgetPattern(budgetEvents),
      ...detectPantryPatterns(pantryItems),
      ...detectRecipeFeedbackPatterns(recipeFeedback),
      ...detectCuisineFeedbackPatterns(cuisineFeedback),
      ...detectPlanSatisfactionPattern(planFeedback),
    ];

    const touchedKeys = new Set(candidates.map((c) => `${c.patternType}:${c.patternKey}`));

    await Promise.all(
      candidates.map((c) =>
        this.prisma.foodPattern.upsert({
          where: { userId_patternType_patternKey: { userId, patternType: c.patternType, patternKey: c.patternKey } },
          create: {
            userId,
            patternType: c.patternType,
            patternKey: c.patternKey,
            patternValue: c.patternValue,
            confidence: confidenceForEvidence(c.evidenceCount),
            evidenceCount: c.evidenceCount,
            firstObservedAt: c.firstObservedAt,
            lastObservedAt: c.lastObservedAt,
            status: 'active',
          },
          update: {
            patternValue: c.patternValue,
            confidence: confidenceForEvidence(c.evidenceCount),
            evidenceCount: c.evidenceCount,
            lastObservedAt: c.lastObservedAt,
            status: 'active',
          },
        }),
      ),
    );

    // Decay every other still-active pattern that this pass didn't reinforce
    // — the evidence for it may simply have aged out of the lookback window,
    // which itself means "this hasn't happened in a while" (brief §20).
    const untouched = await this.prisma.foodPattern.findMany({
      where: { userId, status: 'active' },
      select: { id: true, patternType: true, patternKey: true, confidence: true, lastObservedAt: true },
    });
    const decayUpdates = untouched.filter((p) => !touchedKeys.has(`${p.patternType}:${p.patternKey}`));

    await Promise.all(
      decayUpdates.map((p) => {
        const { confidence, status } = decayConfidence(p.confidence, p.lastObservedAt, now);
        if (confidence === p.confidence && status === 'active') return Promise.resolve();
        return this.prisma.foodPattern.update({ where: { id: p.id }, data: { confidence, status } });
      }),
    );
  }

  /** Active (non-stale) patterns for a user, for the context engine. */
  async getActivePatterns(userId: string) {
    return this.prisma.foodPattern.findMany({ where: { userId, status: 'active' } });
  }

  /** Reset FoodPadi's learned memory for a user (brief §13/§15 "Reset memory"). */
  async resetForUser(userId: string): Promise<void> {
    await this.prisma.foodPattern.deleteMany({ where: { userId } });
  }
}
