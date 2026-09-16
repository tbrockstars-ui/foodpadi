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

class RecipeIngredientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

// Recipes aren't generated-then-referenced-by-id server-side (guest results
// are ephemeral, docs/FOODPADI_AUTHENTICATION_SPEC.md) — the client posts
// back the exact recipe it already has on screen to persist it.
export class SaveRecipeDto {
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
  cuisine?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  steps!: string[];

  // Set when the save comes from tapping the heart on an idea that isn't
  // persisted yet (LikeHeart.tsx) — saves and favourites it in one call
  // instead of a save-then-toggle round trip.
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  // The client always echoes back the RecipeView it has on screen, which may
  // carry these two Cook Today-only fields (recipe-validation.ts). Recipe has
  // no column for either — accepted here only so the global whitelist
  // ValidationPipe doesn't 400 the whole save ("property ... should not
  // exist"), then silently dropped by CookTodayService.save. A saved/resumed
  // recipe simply falls back to the client's own per-step estimate, same as
  // every curated/guest recipe already does without this field.
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
