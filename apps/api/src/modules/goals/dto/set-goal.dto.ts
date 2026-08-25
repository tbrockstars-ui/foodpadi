import { IsIn } from 'class-validator';
import { FOOD_GOALS, FoodGoal } from '@foodpadi/shared';

export class SetGoalDto {
  @IsIn(FOOD_GOALS)
  goalType!: FoodGoal;
}
