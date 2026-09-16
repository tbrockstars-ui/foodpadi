import {
  haveItemsCoverIngredient,
  isVeganFood,
  normalizeIngredientName,
  type HomeIdeaDifficulty,
  type HomeIdeaPriceBand,
  type HomeIdeaView,
} from '@foodpadi/shared';
import { CURATED_RECIPES } from '../ai/curated-recipes';
import { dropRecipesWithAvoided } from '../../common/avoided-ingredients';

/**
 * Home's "Ideas for you" feed — deterministic, no AI (so it's guest-safe and
 * free per view). It scores the same curated recipe pool the guest Cook Today
 * lane uses against whatever the member has actually told FoodPadi: their
 * pantry (the "You have X%" match), their favourite cuisines, and their
 * active goals. Everything here is a pure function over already-fetched
 * strings so it's unit-testable with no database.
 */

interface RecipeLike {
  title: string;
  cookTimeMinutes: number;
  servings: number;
  cuisine: string | null;
  ingredients: { name: string; quantity: string | null; unit: string | null }[];
  steps: string[];
}

export interface IdeaContext {
  /** Lowercased pantry item names. Empty => matchPercent is null (nothing to score against). */
  pantryItems: string[];
  /** Raw avoided-ingredient terms — a hard exclusion, same rule as everywhere else. */
  avoidedIngredients: string[];
  /** Lowercased favourite cuisines. */
  favouriteCuisines: string[];
  /** Active goal type keys, e.g. "quick_meals" | "reduce_spending" | "reduce_waste". */
  activeGoals: string[];
  /**
   * Live signals from the "What should I eat?" search box / mood chips
   * (e.g. "something quick", "comforting", "cheap") — free text, matched
   * against title/cuisine keywords the same way curated-recipes.ts's
   * scoreCuratedByHint matches a Cook Today hint. Soft: it re-ranks, it
   * never excludes.
   */
  moodHint?: string;
  /**
   * A hard cap from the time chips/budget field, applied best-effort — same
   * precedent as pickCuratedRecipes' `maxMinutes`/generateCookTodayRecipes'
   * time constraint: if honouring it would empty the whole pool, it's
   * dropped rather than leaving "Ideas for you" with nothing to show (this
   * is passive browse content, not a query the user is actively waiting on).
   */
  maxTimeMinutes?: number;
  /** Same best-effort contract as maxTimeMinutes, compared against priceBandPence. */
  maxBudgetPence?: number;
}

// Representative pence-per-recipe for each band, for comparing against a
// live budget cap. Same rough ranges FoodPadi's UI shows the user
// (apps/web/app/HomeHub.tsx's PRICE_BAND_ESTIMATE) — a hedged estimate, not
// real pricing data (there is none), so this is only ever used to *order/
// filter* the existing deterministic bands, never surfaced as a claimed cost.
const PRICE_BAND_PENCE: Record<HomeIdeaPriceBand, number> = {
  '£': 450,
  '££': 950,
  '£££': 1600,
};

/** Same keyword-overlap approach as curated-recipes.ts's scoreCuratedByHint. */
function moodMatchScore(hint: string, recipe: RecipeLike): number {
  const words = hint
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  if (words.length === 0) return 0;
  const haystack = `${recipe.title} ${recipe.cuisine ?? ''} ${recipe.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  return words.reduce((s, w) => (haystack.includes(w) ? s + 1 : s), 0);
}

const PREMIUM_INGREDIENTS = ['salmon', 'steak', 'prawn', 'lamb', 'tuna', 'halloumi'];
const MEAT_FISH = [
  'chicken', 'beef', 'pork', 'lamb', 'bacon', 'sausage', 'salmon', 'tuna', 'prawn',
  'fish', 'mince', 'steak', 'drumstick', 'thigh', 'ham',
];

export function pantryMatchPercent(recipe: RecipeLike, pantryItems: string[]): number | null {
  if (pantryItems.length === 0) return null;
  const total = recipe.ingredients.length;
  if (total === 0) return null;
  const have = recipe.ingredients.filter((i) => haveItemsCoverIngredient(pantryItems, i.name)).length;
  return Math.round((have / total) * 100);
}

export function difficultyOf(recipe: RecipeLike): HomeIdeaDifficulty {
  const steps = recipe.steps.length;
  const time = recipe.cookTimeMinutes;
  if (steps <= 3 && time <= 25) return 'Easy';
  if (steps >= 5 || time >= 55) return 'Hard';
  return 'Medium';
}

export function priceBandOf(recipe: RecipeLike): HomeIdeaPriceBand {
  const names = recipe.ingredients.map((i) => normalizeIngredientName(i.name)).join(' ');
  const count = recipe.ingredients.length;
  if (count >= 8 || PREMIUM_INGREDIENTS.some((p) => names.includes(p))) return '£££';
  const hasMeatOrFish = MEAT_FISH.some((m) => names.includes(m));
  if (!hasMeatOrFish && count <= 5) return '£';
  return '££';
}

function slugify(title: string): string {
  return normalizeIngredientName(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function scoreRecipe(
  recipe: RecipeLike,
  ctx: IdeaContext,
  matchPercent: number | null,
  priceBand: HomeIdeaPriceBand,
): number {
  let score = matchPercent ?? 0;
  if (recipe.cuisine && ctx.favouriteCuisines.includes(normalizeIngredientName(recipe.cuisine))) score += 20;
  if (ctx.activeGoals.includes('quick_meals') && recipe.cookTimeMinutes <= 25) score += 12;
  if (ctx.activeGoals.includes('reduce_spending') && priceBand === '£') score += 12;
  if (ctx.activeGoals.includes('reduce_waste')) score += (matchPercent ?? 0) * 0.3;
  // Live "what should I eat?" mood/search text — weighted above the profile
  // signals above (x8) since it's what the user is asking for *right now*,
  // not a standing preference.
  if (ctx.moodHint?.trim()) score += moodMatchScore(ctx.moodHint, recipe) * 8;
  // Live time/budget constraints steer ordering too, not just the best-effort
  // filter in rankHomeIdeas below — a recipe comfortably within budget/time
  // should still rank above one that's merely allowed through.
  if (ctx.maxTimeMinutes !== undefined && recipe.cookTimeMinutes <= ctx.maxTimeMinutes) score += 6;
  if (ctx.maxBudgetPence !== undefined && PRICE_BAND_PENCE[priceBand] <= ctx.maxBudgetPence) score += 6;
  // Stable, sensible tiebreak so ordering is deterministic even when nothing
  // else separates two ideas (notably for a guest with no pantry/goals):
  // the quicker meal wins.
  score -= recipe.cookTimeMinutes * 0.01;
  return score;
}

/**
 * Best-effort hard filter for a live time/budget cap — same contract as
 * pickCuratedRecipes' maxMinutes (curated-recipes.ts): applied only when it
 * doesn't empty the pool, since "Ideas for you" must never go blank just
 * because a constraint was too tight for every curated recipe.
 */
function applyBestEffort<T>(items: T[], predicate: (item: T) => boolean): T[] {
  const filtered = items.filter(predicate);
  return filtered.length > 0 ? filtered : items;
}

export function rankHomeIdeas(
  ctx: IdeaContext,
  pool: RecipeLike[] = CURATED_RECIPES as unknown as RecipeLike[],
  limit = 3,
): HomeIdeaView[] {
  let safe = dropRecipesWithAvoided(pool, ctx.avoidedIngredients);

  // "Vegan" in the live mood text is a dietary hard filter, not a re-ranking
  // preference like the rest of moodHint below — showing "Chicken & Avocado
  // Salad" next to a "Vegan" pick would be actively wrong, not just a worse
  // match, so this drops unconditionally (no applyBestEffort fallback; if
  // the curated pool has nothing that says "vegan", the honest result is
  // fewer/zero ideas, never a non-vegan one standing in for it). Same
  // best-effort-title-match contract as everywhere else (isVeganFood).
  if (ctx.moodHint && /\bvegan\b/i.test(ctx.moodHint)) {
    safe = safe.filter((r) => isVeganFood({ title: r.title }));
  }

  if (ctx.maxTimeMinutes !== undefined) {
    const maxTime = ctx.maxTimeMinutes;
    safe = applyBestEffort(safe, (r) => r.cookTimeMinutes <= maxTime);
  }
  if (ctx.maxBudgetPence !== undefined) {
    const maxBudget = ctx.maxBudgetPence;
    safe = applyBestEffort(safe, (r) => PRICE_BAND_PENCE[priceBandOf(r)] <= maxBudget);
  }

  const scored = safe.map((recipe) => {
    const matchPercent = pantryMatchPercent(recipe, ctx.pantryItems);
    const priceBand = priceBandOf(recipe);
    return {
      recipe,
      matchPercent,
      priceBand,
      difficulty: difficultyOf(recipe),
      score: scoreRecipe(recipe, ctx, matchPercent, priceBand),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry, index) => ({
    slug: slugify(entry.recipe.title),
    title: entry.recipe.title,
    cuisine: entry.recipe.cuisine,
    timeMinutes: entry.recipe.cookTimeMinutes,
    difficulty: entry.difficulty,
    priceBand: entry.priceBand,
    matchPercent: entry.matchPercent,
    bestMatch: index === 0 && entry.matchPercent !== null && entry.matchPercent > 0,
    recipe: {
      title: entry.recipe.title,
      cookTimeMinutes: entry.recipe.cookTimeMinutes,
      servings: entry.recipe.servings,
      cuisine: entry.recipe.cuisine,
      ingredients: entry.recipe.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
      })),
      steps: entry.recipe.steps,
    },
  }));
}
