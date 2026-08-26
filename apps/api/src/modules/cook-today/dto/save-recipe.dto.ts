import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
}
