import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const STAGES = ['recipe_selected', 'ingredient_check', 'shopping', 'ready_to_cook', 'cooking', 'feedback_pending'] as const;

// One scanned / user-added item: same shape as ScannedItemView / a pantry
// item. `null` quantity/unit are allowed (that's what the scanner emits).
class IngredientCheckItemDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  quantity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string | null;
}

class IngredientNeedDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  note?: string | null;
}

/**
 * The full persisted fridge-scan / ingredient-comparison session (docs
 * cooking-journey brief §2/§34). Bounded so a client can't post an unbounded
 * blob onto the journey row. Stored verbatim as JSON on
 * CookingJourney.ingredientStatus; the shared migrateIngredientCheckState()
 * normalises it on read.
 */
export class IngredientCheckStateDto {
  @IsIn([2])
  v!: 2;

  @IsIn(['reviewScan', 'reconciled'])
  subStage!: 'reviewScan' | 'reconciled';

  @IsBoolean()
  skipped!: boolean;

  @IsOptional()
  @IsISO8601()
  scannedAt?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IngredientCheckItemDto)
  detected!: IngredientCheckItemDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  confirmedNames!: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => IngredientCheckItemDto)
  manualHave!: IngredientCheckItemDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  haveNames!: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IngredientNeedDto)
  need!: IngredientNeedDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  purchasedNames!: string[];
}

/**
 * PATCH /cooking-journey/:id — advance the active journey. Every field is
 * optional; only the ones present are written. `status` here is limited to
 * the client-driven terminal transitions ('completed' after rating,
 * 'cancelled' via the explicit "start something else" path); 'abandoned' is
 * server-only.
 */
export class UpdateCookingJourneyDto {
  @IsOptional()
  @IsIn(STAGES)
  stage?: (typeof STAGES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStep?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IngredientCheckStateDto)
  ingredientState?: IngredientCheckStateDto;

  @IsOptional()
  @IsString()
  shoppingListId?: string;

  @IsOptional()
  @IsString()
  feedbackId?: string;

  @IsOptional()
  @IsIn(['completed', 'cancelled'])
  status?: 'completed' | 'cancelled';
}
