import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Mirrors SaveRecipeDto (cook-today/dto/save-recipe.dto.ts) — a fresh Cook
// Today result has no server id yet, so the client posts back the recipe it
// has on screen and the journey service persists it via CookTodayService.save
// before referencing it. `quantity`/`unit` accept null (RecipeView sends
// nulls, not absent keys).
class JourneyRecipeIngredientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  quantity?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;
}

class JourneyRecipeDto {
  @IsString()
  title!: string;

  @IsInt()
  @Min(1)
  @Max(600)
  cookTimeMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(24)
  servings!: number;

  @IsOptional()
  @IsString()
  cuisine?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => JourneyRecipeIngredientDto)
  ingredients!: JourneyRecipeIngredientDto[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  steps!: string[];

  // Same as SaveRecipeDto's twin fields (cook-today/dto/save-recipe.dto.ts) —
  // accepted only so the client's full RecipeView doesn't 400 the whole
  // journey creation, then dropped: CookTodayService.save persists the
  // recipe without them (Recipe has no column for either), so the journey's
  // snapshot falls back to the same per-step estimate any recipe without
  // this field already uses.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  stepDurationsSeconds?: (number | null)[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  prepTimeMinutes?: number;
}

/**
 * POST /cooking-journey — start (or, with `replace`, swap) the user's one
 * active cooking journey. Supply exactly one of `recipeId` (a saved recipe or
 * plan meal) or `recipe` (a fresh Cook Today result). `mealPlanItemId` marks
 * a Plan Ahead origin. See CookingJourneyService.create.
 */
export class CreateCookingJourneyDto {
  @IsOptional()
  @IsString()
  recipeId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => JourneyRecipeDto)
  recipe?: JourneyRecipeDto;

  @IsOptional()
  @IsString()
  mealPlanItemId?: string;

  // Without this, an existing active journey makes the request 409
  // (ACTIVE_JOURNEY_EXISTS). With it, the old journey is cancelled first
  // (brief §16/§17 — never silently destroyed).
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}
