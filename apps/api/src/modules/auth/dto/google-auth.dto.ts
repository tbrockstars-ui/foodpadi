import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleAuthDto {
  // The Google ID token (a JWT). Verified against Google's tokeninfo endpoint
  // in AuthService.loginWithGoogle — never trusted as-is.
  @IsString()
  @MinLength(20)
  idToken!: string;

  // "Feed a Friend" referral code — only used when this sign-in creates a
  // brand-new account (docs/REFERRAL_PLAN.md). Ignored for an existing user.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
