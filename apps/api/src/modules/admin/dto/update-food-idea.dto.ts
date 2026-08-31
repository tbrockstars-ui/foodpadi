import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const BUDGET_TIERS = ['low', 'medium', 'high'] as const;

// Every field optional — an edit can touch just one field (e.g. only
// toggling isActive) without having to resend the whole dish. `slug` is
// deliberately not editable here: it's the stable id eat-now-estimates.ts's
// per-dish hash and every client's FoodIdeaView.id already key on, so
// changing it after creation would silently reshuffle a dish's "distance"
// estimate and orphan anything referencing the old value.
export class UpdateFoodIdeaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  cuisine?: string;

  @IsOptional()
  @IsIn(BUDGET_TIERS)
  budgetTier?: (typeof BUDGET_TIERS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
