import { IsBoolean, IsOptional } from 'class-validator';

// Body for POST /plan-ahead/:planId/shopping-list.
export class GenerateShoppingListDto {
  // true  -> rebuild an existing list from the plan's current meals
  //          (auto-derived items replaced, manually-added items kept).
  // false/omitted -> return the existing list unchanged (idempotent, the
  //          original behaviour).
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}
