import { IsOptional, IsString, Matches } from 'class-validator';

export class PricingQueryDto {
  // ISO 3166-1 alpha-2 country hint for the pre-checkout local-currency
  // estimate. Optional — the controller also falls back to the request's
  // Accept-Language header. Never used to compute a charge.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'country must be a 2-letter ISO country code.' })
  country?: string;
}
