import type { FoodGoal } from '@foodpadi/shared';

// Maps the non-medical food/lifestyle goals (packages/shared/src/foodGoals.ts)
// to short imperative steering phrases the recipe / meal-plan prompts drop
// straight into the user message. Deliberately vague and non-medical — these
// nudge the model, they are not constraints, and none of them mentions
// health, calories, or weight loss (spec §10). 'none' and 'personal' are
// handled separately below; anything unmapped contributes nothing.
const GOAL_PHRASES: Partial<Record<FoodGoal, string>> = {
  balanced_meals: 'aim for balanced plates — a protein, a vegetable and a carbohydrate in most meals',
  support_fitness: 'include a solid protein source in each meal',
  maintain_weight:
    'keep portions moderate and lean toward lighter dishes — plenty of vegetables and leaner ' +
    'proteins, and less deep-fried, heavily creamy or sugary food',
  reduce_spending: 'lean toward inexpensive, everyday ingredients and simple dishes',
  reduce_waste: 'favour dishes that use common ingredients fully, with few awkward leftovers',
  home_cooked: 'keep everything cooked from scratch with whole ingredients, no ready-made shortcuts',
  explore_cuisines: 'lean toward more varied and less familiar cuisines',
};

export interface GoalContext {
  /** The user's active goal types (goals.service getGoals). */
  goalTypes: FoodGoal[];
  /** Free text, only set when 'personal' is among the goals. */
  personalNote?: string | null;
}

/**
 * One combined sentence of soft guidance built from a user's active goals,
 * or null when there is nothing worth saying (no goals, or only 'none').
 * Shared by Cook Today and Plan Ahead so both phrase goals identically.
 */
export function goalGuidanceLine(ctx: GoalContext): string | null {
  const phrases = ctx.goalTypes
    .filter((g) => g !== 'none' && g !== 'personal')
    .map((g) => GOAL_PHRASES[g])
    .filter((phrase): phrase is string => !!phrase);

  if (ctx.goalTypes.includes('personal') && ctx.personalNote?.trim()) {
    phrases.push(`the user also notes: "${ctx.personalNote.trim()}"`);
  }

  if (phrases.length === 0) return null;

  return (
    `The user's food goals: ${phrases.join('; ')}. ` +
    'Treat these as soft preferences, not hard rules, and never frame a dish as healthy, ' +
    'medical, or weight-loss related.'
  );
}
