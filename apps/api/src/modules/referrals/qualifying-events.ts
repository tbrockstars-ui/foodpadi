/**
 * A referred user's registration stays "pending" until they do something that
 * shows real intent — one of these domain events (docs/REFERRAL_PLAN.md §2.4).
 * Deliberately small: generate a decision, generate or save a recipe, search
 * Eat Now, or accept a plan. Merely viewing a screen never qualifies.
 *
 * Every name here is already emitted by a feature service through
 * AnalyticsService.track() — this list only ever *subsets* existing events,
 * it never introduces new ones. Adding an event to the "meaningful action"
 * bar later is a one-line change here.
 */
export const REFERRAL_QUALIFYING_EVENTS: ReadonlySet<string> = new Set([
  'decide_options_generated',
  'cook_today_recipes_generated',
  'cook_today_recipe_saved',
  'eat_now_searched',
  'plan_ahead_accepted',
]);
