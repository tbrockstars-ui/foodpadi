import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  // "Feed a Friend" referral code from an invite link (docs/REFERRAL_PLAN.md).
  // Attribution is best-effort — an unknown/self/duplicate code is ignored and
  // never blocks registration. On web this is filled in by the register route
  // handler from the `fp_ref` cookie, not typed by the user.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
