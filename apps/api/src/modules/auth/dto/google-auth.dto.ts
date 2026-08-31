import { IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  // The Google ID token (a JWT). Verified against Google's tokeninfo endpoint
  // in AuthService.loginWithGoogle — never trusted as-is.
  @IsString()
  @MinLength(20)
  idToken!: string;
}
