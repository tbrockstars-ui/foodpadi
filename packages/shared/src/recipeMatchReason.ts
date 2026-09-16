// Deterministic "why FoodPadi thinks this fits" reasoning for a Cook Today
// meal option card — shared between web (CookTodayForm.tsx's results step)
// and mobile (CookTodayScreen.tsx's results step) so both platforms show the
// same reasoning for the same recipe/request. Pure and AI-free by design: the
// signal is entirely the request the user just made (their free text, picked
// ingredients, time limit) compared against fields the recipe already has —
// no extra network/AI call per card, matching the "don't call AI just to
// decide whether a recipe is a good match" cost-control rule.
import { haveItemsCoverIngredient, normalizeIngredientName } from './ingredientMatch';

export interface RecipeMatchInput {
  title: string;
  cuisine: string | null;
  cookTimeMinutes: number;
  ingredients: { name: string }[];
}

export interface RecipeMatchContext {
  /** The free-text request, if that entry point was used ("I want to cook jollof rice for 4"). */
  query?: string;
  /** Ingredients picked via the chip picker, if that entry point was used instead. */
  pickedIngredients?: string[];
  /** The user's stated time limit, if any (from the time-filter chips). */
  timeConstraintMinutes?: number;
}

export interface RecipeMatchResult {
  /** One short sentence for the card body — always present, never fabricated. */
  reason: string;
  /** A compact badge label, or null when nothing specific stood out (still a
   * fine recommendation, just not one FoodPadi can point at a reason for). */
  badge: string | null;
}

// Ignore short/common words when matching the recipe title against free
// text ("a", "the", "with", but also generic dish nouns like "rice" or
// "sauce") — they'd match almost any request and every card would end up
// with the same generic "matches what you asked for", telling the user
// nothing. The >=5-char length floor does most of that work on its own;
// the explicit list catches short-but-generic words that would otherwise
// slip through.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'for', 'of', 'in', 'to', 'my',
  'rice', 'meal', 'dish', 'food', 'sauce', 'soup',
]);

function titleWordsIn(title: string, query: string): boolean {
  const q = normalizeIngredientName(query);
  return title
    .split(/\s+/)
    .map((w) => normalizeIngredientName(w).replace(/[^a-z0-9]/g, ''))
    .some((word) => word.length >= 5 && !STOPWORDS.has(word) && q.includes(word));
}

export function describeRecipeMatch(recipe: RecipeMatchInput, context: RecipeMatchContext): RecipeMatchResult {
  const { query, pickedIngredients, timeConstraintMinutes } = context;

  if (timeConstraintMinutes && recipe.cookTimeMinutes <= timeConstraintMinutes) {
    return { reason: `Fits your ${timeConstraintMinutes}-minute time limit.`, badge: 'Good match' };
  }

  if (query && recipe.cuisine && normalizeIngredientName(query).includes(normalizeIngredientName(recipe.cuisine))) {
    return { reason: `Matches the ${recipe.cuisine} you asked for.`, badge: 'Good match' };
  }

  if (query && titleWordsIn(recipe.title, query)) {
    return { reason: 'Matches what you asked for.', badge: 'Good match' };
  }

  if (pickedIngredients && pickedIngredients.length > 0) {
    const overlap = recipe.ingredients.filter((i) => haveItemsCoverIngredient(pickedIngredients, i.name)).length;
    if (overlap > 0) {
      return {
        reason: `Uses ${overlap} of the ingredient${overlap === 1 ? '' : 's'} you picked.`,
        badge: `Uses ${overlap} ingredient${overlap === 1 ? '' : 's'} you have`,
      };
    }
  }

  return { reason: "One of FoodPadi's picks for you today.", badge: null };
}
