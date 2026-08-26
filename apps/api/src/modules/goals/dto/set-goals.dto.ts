import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { FOOD_GOALS, FoodGoal, MAX_FOOD_GOALS } from '@foodpadi/shared';

export class SetGoalsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FOOD_GOALS)
  @ArrayUnique()
  @IsIn(FOOD_GOALS, { each: true })
  goalTypes!: FoodGoal[];

  @IsOptional()
  @IsIn(FOOD_GOALS)
  primaryGoalType?: FoodGoal;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  personalGoalNote?: string;
}
