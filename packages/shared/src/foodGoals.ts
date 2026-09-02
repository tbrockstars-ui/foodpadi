/**
 * Non-medical food/lifestyle goal set (spec §10). Body-shape / weight-loss /
 * calorie / guilt framing is intentionally excluded — this list is the only
 * valid set, and every entry has to stay on the "budget, waste, cooking,
 * variety, less stress" side of the product's promise (PRODUCT_VISION.md).
 *
 * Order is intent-first: the goals most people arrive with lead, the
 * situational and niche ones follow, `personal` / `none` last.
 */
export const FOOD_GOALS = [
  'balanced_meals',
  'eat_more_plants',
  'quick_meals',
  'reduce_spending',
  'reduce_waste',
  'home_cooked',
  'explore_cuisines',
  'cook_for_others',
  'support_fitness',
  'maintain_weight',
  'personal',
  'none',
] as const;

export type FoodGoal = (typeof FOOD_GOALS)[number];

export const MAX_FOOD_GOALS = 3;
