import { FoodGoal } from '@foodpadi/shared';

// Labels for the non-medical goal set (spec §10 / Decision 13). Never add a
// body-shape or weight-loss framed option to this list. Shared between
// GoalsEditor and ProfileScreen so both surfaces stay in sync.
export const GOAL_LABELS: Record<FoodGoal, string> = {
  balanced_meals: 'Eat more balanced meals',
  support_fitness: 'Support my fitness',
  maintain_weight: 'Maintain my current weight',
  reduce_spending: 'Reduce food spending',
  reduce_waste: 'Reduce food waste',
  home_cooked: 'Eat more home-cooked meals',
  explore_cuisines: 'Explore new foods',
  personal: 'Personal goal',
  none: 'No particular goal',
};
