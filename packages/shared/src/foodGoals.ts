/**
 * Non-medical food/lifestyle goal set (spec §10). Body-shape/weight-loss
 * framing is intentionally excluded — this list is the only valid set.
 */
export const FOOD_GOALS = [
  'balanced_meals',
  'support_fitness',
  'maintain_weight',
  'reduce_spending',
  'reduce_waste',
  'home_cooked',
  'explore_cuisines',
  'personal',
  'none',
] as const;

export type FoodGoal = (typeof FOOD_GOALS)[number];
