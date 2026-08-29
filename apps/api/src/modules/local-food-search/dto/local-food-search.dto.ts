import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LocalFoodSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;

  // Preferred path: real coordinates from the browser/device geolocation
  // API. Both must be present together — validated as a pair, not required
  // outright, since the manual locationText fallback covers the other case
  // (checked in the service, since class-validator doesn't do cross-field
  // "at least one of A or B" checks cleanly without a custom decorator).
  @ValidateIf((o) => o.latitude !== undefined || o.longitude !== undefined)
  @IsLatitude()
  latitude?: number;

  @ValidateIf((o) => o.latitude !== undefined || o.longitude !== undefined)
  @IsLongitude()
  longitude?: number;

  // Fallback when location permission is denied/unavailable: a postcode,
  // town, or area, typed by the user.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  locationText?: string;
}
