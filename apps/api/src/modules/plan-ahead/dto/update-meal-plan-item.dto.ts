import { IsIn, IsOptional, Matches } from 'class-validator';

export type MealChoice = 'cook' | 'eat_out';

export class UpdateMealPlanItemDto {
  @IsOptional()
  @IsIn(['cook', 'eat_out'])
  mealChoice?: MealChoice;

  // "HH:mm", 24h — e.g. "18:30". Send null to clear a previously-set time
  // (and cancel any reminder the client had scheduled for it).
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'plannedTime must be in 24h HH:mm format, e.g. 18:30' })
  plannedTime?: string | null;
}
