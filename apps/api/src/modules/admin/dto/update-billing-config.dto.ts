import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * Admin edit to the parameterised subscription values (billing_config).
 * Every field optional — only what's sent is changed. Deeper validation of
 * `currencyOptions` (keys are 3-letter codes, values positive integers) is in
 * BillingConfigService.update so one place owns it.
 */
export class UpdateBillingConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(500000)
  basePriceCents?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{3}$/, { message: 'baseCurrency must be a 3-letter lowercase ISO code.' })
  baseCurrency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  trialDays?: number;

  // In-app Guest/Trial/Paid model — no-card trial length and its AI cap.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  appTrialDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  trialAiLimit?: number;

  // Payment-failure grace / dunning window in days.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  pastDueGraceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(100000000)
  flwNgnAmount?: number;

  // FoodPadi Food Dealer Network subscription price (a separate product).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(500000)
  dealerPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(100000000)
  dealerNgnAmount?: number;

  @IsOptional()
  @IsObject()
  currencyOptions?: Record<string, number>;
}
