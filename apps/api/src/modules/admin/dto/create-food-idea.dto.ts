import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const BUDGET_TIERS = ['low', 'medium', 'high'] as const;

export class CreateFoodIdeaDto {
  // The stable, human-readable id every other part of the app keys on
  // (FoodIdeaView.id sent to clients, eat-now-estimates.ts's per-dish hash)
  // — auto-generated from the title if not given explicitly.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters/numbers separated by single hyphens (e.g. "chicken-biryani").',
  })
  slug?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  cuisine!: string;

  @IsIn(BUDGET_TIERS)
  budgetTier!: (typeof BUDGET_TIERS)[number];

  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  tags!: string[];
}
