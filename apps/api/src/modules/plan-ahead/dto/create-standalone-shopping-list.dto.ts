import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

// Same shape as AddShoppingListItemDto (shopping-list-item.dto.ts) — kept as
// its own class (not a reuse-by-import) to mirror AddPantryItemsDto's nested-
// array pattern exactly, and because a standalone list's initial items are a
// batch, not a single add.
class StandaloneShoppingListItemDto {
  @IsString()
  @MaxLength(120)
  ingredientName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  quantity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;
}

/**
 * A shopping list created directly from an ingredient list (e.g. Cook
 * Today's fridge-check "you need to buy" set) rather than from an accepted
 * Plan Ahead plan — see PlanAheadService.createStandaloneShoppingList.
 * `ShoppingListView.mealPlanId` is null for a list created this way.
 */
export class CreateStandaloneShoppingListDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StandaloneShoppingListItemDto)
  items!: StandaloneShoppingListItemDto[];

  // When set, links the new list to this active Cooking Journey and moves
  // that journey to the "shopping" stage — so the cook can leave FoodPadi
  // and come back to exactly this list (docs cooking-journey brief §5).
  @IsOptional()
  @IsString()
  cookingJourneyId?: string;
}
