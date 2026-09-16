import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  // ISO 3166-1 alpha-2 country of residence (the web form requires it; optional
  // here so Google/mobile signups aren't blocked). Drives Premium currency +
  // payment provider.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'countryCode must be a 2-letter ISO country code.' })
  countryCode?: string;

  // "Feed a Friend" referral code from an invite link (docs/REFERRAL_PLAN.md).
  // Attribution is best-effort — an unknown/self/duplicate code is ignored and
  // never blocks registration. On web this is filled in by the register route
  // handler from the `fp_ref` cookie, not typed by the user.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
