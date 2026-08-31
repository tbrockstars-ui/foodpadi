// Turns a recommendation's dish name (and optional cuisine) into a tight,
// food-specific image-search query — deterministic string work, no LLM call
// (same spirit as EatNowService's matcher). The goal is the closest visual
// match: "Chicken Biryani" -> "chicken biryani indian food", not a broad
// "food" search. See the visual-redesign brief §28/§29.

// Dropped from the query — filler that only dilutes an image search. "and"/
// "or" are deliberately kept: they carry meaning in dish names ("fish and
// chips", "rice and peas", "sweet and sour"), and the brief's own worked
// examples keep them (§28).
const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'of', 'with', 'some', 'your', 'my', 'our',
  'choice', 'served', 'topped', 'style', 'homemade', 'classic', 'proper',
  'big', 'bowl', 'plate', 'portion', 'side', 'fresh',
]);

// The query already describes a dish; this just nudges the provider toward
// food photography rather than, say, a raw-ingredient or restaurant shot.
const FOOD_SUFFIX = 'food';

// A few dishes whose generic image results drift toward the wrong thing
// without a cuisine anchor (brief §29 — jollof must look like jollof, not
// generic tomato rice; biryani not generic curry). Matched as a substring
// of the normalised name. Only used when the caller didn't pass a cuisine.
const CUISINE_HINTS: { match: string; hint: string }[] = [
  { match: 'jollof', hint: 'nigerian' },
  { match: 'egusi', hint: 'nigerian' },
  { match: 'suya', hint: 'nigerian' },
  { match: 'biryani', hint: 'indian' },
  { match: 'jerk chicken', hint: 'caribbean' },
  { match: 'pho', hint: 'vietnamese' },
  { match: 'banh mi', hint: 'vietnamese' },
  { match: 'katsu', hint: 'japanese' },
  { match: 'ramen', hint: 'japanese' },
  { match: 'pad thai', hint: 'thai' },
];

/** Lowercased, punctuation-stripped, whitespace-collapsed — also the cache key. */
export function normaliseFoodKey(foodName: string): string {
  return foodName
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical asides
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFoodImageQuery(foodName: string, cuisine?: string): string {
  const normalised = normaliseFoodKey(foodName);

  const dishWords = normalised.split(' ').filter((w) => w.length > 0 && !FILLER_WORDS.has(w));

  const cuisineHint =
    cuisine && cuisine.trim()
      ? normaliseFoodKey(cuisine).split(' ')[0] // "Nigerian & West African" -> "nigerian"
      : CUISINE_HINTS.find((h) => normalised.includes(h.match))?.hint;

  const parts = [...dishWords];
  if (cuisineHint && !parts.includes(cuisineHint)) parts.push(cuisineHint);
  if (!parts.includes(FOOD_SUFFIX)) parts.push(FOOD_SUFFIX);

  return parts.join(' ');
}
