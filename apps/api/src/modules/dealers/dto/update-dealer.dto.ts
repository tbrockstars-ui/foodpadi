import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DEALER_SERVICE_TYPES,
  DEALER_TYPES,
  type DealerServiceType,
  type DealerType,
} from '@foodpadi/shared';
import { DEALER_LIMITS } from '../dealer-taxonomy';

// A raw opening-hours map { "mon": "09:00-18:00", ... }. Values are shown to
// customers verbatim, never parsed into an "open now" claim, so no strict
// format is enforced here beyond "short strings" (dealer brief §27).
class OpeningHoursDto {
  @IsOptional() @IsString() @MaxLength(60) mon?: string;
  @IsOptional() @IsString() @MaxLength(60) tue?: string;
  @IsOptional() @IsString() @MaxLength(60) wed?: string;
  @IsOptional() @IsString() @MaxLength(60) thu?: string;
  @IsOptional() @IsString() @MaxLength(60) fri?: string;
  @IsOptional() @IsString() @MaxLength(60) sat?: string;
  @IsOptional() @IsString() @MaxLength(60) sun?: string;
}

export class UpdateDealerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;

  @IsOptional() @IsIn(DEALER_TYPES as unknown as string[]) dealerType?: DealerType;

  // Contact / ordering channels — only ever stored, never fabricated (brief §27).
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(300) websiteUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(300) orderUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours?: Record<string, string> | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DEALER_LIMITS.categories)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DEALER_LIMITS.cuisines)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  cuisines?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DEALER_LIMITS.productKeywords)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  productKeywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  dietaryTags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DEALER_SERVICE_TYPES.length)
  @IsIn(DEALER_SERVICE_TYPES as unknown as string[], { each: true })
  serviceType?: DealerServiceType[];
}
