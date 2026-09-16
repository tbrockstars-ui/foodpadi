// Fuzzy ingredient-name matching shared between the API (Home's "Ideas for
// you" pantry-match scoring, apps/api/src/modules/home/home-ideas.ts) and the
// web app (Cook Today's fridge-check ingredient reconciliation,
// apps/web/app/cook-today/FridgeCheck.tsx) — same simple substring-both-ways
// heuristic in one place instead of two copies drifting apart. Deliberately
// no singular/plural stemming or unit-conversion: a plain substring match
// already covers "onion"/"onions"/"red onion" well enough, and anything
// smarter would need a real ingredient ontology FoodPadi doesn't have.

export function normalizeIngredientName(value: string): string {
  return value.trim().toLowerCase();
}

/** True if `haveItems` contains something that covers `ingredientName` — either
 * name contains the other, after normalising (so "onion" covers "red onion"
 * and vice versa). */
export function haveItemsCoverIngredient(haveItems: string[], ingredientName: string): boolean {
  const ing = normalizeIngredientName(ingredientName);
  return haveItems.some((have) => {
    const item = normalizeIngredientName(have);
    return item.length > 1 && (ing.includes(item) || item.includes(ing));
  });
}
