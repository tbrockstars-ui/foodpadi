import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinWaitlistDto {
  @IsEmail()
  email!: string;

  // Unticked by default on the form — omitted or false means no consent.
  // Separate concept from waitlist membership itself (see WaitlistSignup).
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  // Defaults to 'general' server-side (see WaitlistService.join) when omitted.
  @IsOptional()
  @IsIn(['general', 'ios_waitlist'])
  purpose?: 'general' | 'ios_waitlist';

  // Free-text attribution (?source=/?campaign=) — capped short since this is
  // a UTM-style label, not user content.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  campaign?: string;
}
