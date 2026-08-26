import { IsIn, IsOptional } from 'class-validator';
import { FOOD_GOALS, FoodGoal, GOAL_CLIENT_EVENT_TYPES, GoalClientEventType } from '@foodpadi/shared';

/**
 * A narrowly-scoped, allowlisted event sink for the Goals screen's UI-only
 * interactions (view/select/deselect/etc) — there's no generic "log
 * arbitrary client event" endpoint on purpose, to avoid it becoming an open
 * analytics-injection sink. `food_goals_completed` isn't allowed here: the
 * API tracks that itself, from GoalsService, when a save actually succeeds.
 */
export class TrackGoalEventDto {
  @IsIn(GOAL_CLIENT_EVENT_TYPES)
  eventType!: GoalClientEventType;

  @IsOptional()
  @IsIn(FOOD_GOALS)
  goalType?: FoodGoal;
}
