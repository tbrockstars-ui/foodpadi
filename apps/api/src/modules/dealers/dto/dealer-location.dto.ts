import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DEALER_LIMITS } from '../dealer-taxonomy';

export class DealerLocationDto {
  @IsOptional() @IsString() @MaxLength(120) label?: string | null;
  @IsOptional() @IsString() @MaxLength(200) addressLine?: string | null;

  // Town/city name — required, this is the locality-search key (brief §6).
  @IsString() @MinLength(2) @MaxLength(120) locality!: string;

  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsString() @MaxLength(120) region?: string | null;
  @IsOptional() @IsString() @MaxLength(16) postcode?: string | null;
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;

  @IsOptional() @IsBoolean() isPrimary?: boolean;

  // Extra localities served beyond the physical site (brief §31). A distributor
  // must not claim arbitrary places — the portal UI sources these from a
  // gazetteer, and this only caps the count server-side.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DEALER_LIMITS.serviceAreasPerLocation)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  serviceAreas?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(500) serviceRadiusMiles?: number | null;
}
