/**
 * The single place every recommendation surface checks a generated recipe
 * against the user's avoided-ingredients list. AI prompts are told to avoid
 * these too, but a prompt is a request, not a guarantee — a model can still
 * slip one in, especially over a multi-day plan. This is the hard backstop:
 * substring match against title + ingredient names, same as EatNowService's
 * catalog filter, so "avoid peanuts" means the same thing everywhere in the
 * app rather than being enforced in some places and merely suggested in
 * others.
 */
export function matchesAvoidedTerm(haystack: string, avoidedTerms: string[]): boolean {
  if (avoidedTerms.length === 0) return false;
  const lower = haystack.toLowerCase();
  return avoidedTerms.some((term) => {
    const trimmed = term.trim().toLowerCase();
    return trimmed.length > 0 && lower.includes(trimmed);
  });
}

/**
 * Drops any recipe whose title or ingredient list names an avoided term.
 * Deliberately typed to only what it reads (title + ingredient names)
 * rather than the full RecipeView, so any recipe-shaped candidate — sanitized
 * or not, RecipeView or a lighter DTO — can be filtered without an unrelated
 * field (quantity, unit, ...) forcing a cast at the call site.
 */
export function dropRecipesWithAvoided<T extends { title: string; ingredients: { name: string }[] }>(
  recipes: T[],
  avoidedTerms: string[],
): T[] {
  if (avoidedTerms.length === 0) return recipes;
  return recipes.filter(
    (recipe) => !matchesAvoidedTerm(`${recipe.title} ${recipe.ingredients.map((i) => i.name).join(' ')}`, avoidedTerms),
  );
}
