import { FoodGoal } from '@foodpadi/shared';

// Labels for the non-medical goal set (spec §10 / Decision 13). Never add a
// body-shape, weight-loss, calorie or guilt-framed option to this list —
// every entry stays on the "budget, waste, cooking, variety, less stress"
// side of the product promise (docs/PRODUCT_VISION.md). Shared between
// GoalsEditor and ProfileScreen so both surfaces stay in sync; the web
// equivalents live in apps/web/app/goal/GoalForm.tsx and
// apps/web/app/profile/GoalsSection.tsx.
export const GOAL_LABELS: Record<FoodGoal, string> = {
  balanced_meals: 'Eat well without the stress',
  eat_more_plants: 'Eat more veg and plants',
  quick_meals: 'Get dinner done faster',
  reduce_spending: 'Spend less on food',
  reduce_waste: 'Waste less of what I buy',
  home_cooked: 'Cook from scratch more often',
  explore_cuisines: 'Break out of my food rut',
  cook_for_others: 'Cook meals my household enjoys',
  support_fitness: 'Eat to support my training',
  maintain_weight: 'Keep my weight steady',
  personal: 'Something else',
  none: 'Just exploring for now',
};
