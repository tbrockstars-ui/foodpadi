import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  // ISO 3166-1 alpha-2 country of residence — drives Premium currency + provider.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must be a 2-letter ISO country code.' })
  countryCode?: string;

  // Avatar picker (user instruction 2026-09-11). null clears it (both fields).
  // No @Type() coercion here — this is a JSON body (already a real number or
  // null), and coercing null through Number() would turn it into 0 before
  // @IsOptional() gets a chance to see the null and skip validation.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  birthMonth?: number | null;

  // "<month>-<shade>" — validated against the shared avatars.ts whitelist in
  // the service (class-validator alone can't express "one of these 36 ids"
  // without duplicating the generator logic here).
  @IsOptional()
  @IsString()
  @MaxLength(10)
  avatarId?: string | null;
}
