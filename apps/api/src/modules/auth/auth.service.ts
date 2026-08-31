import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDurationMs } from '../../common/duration.util';
import { MailerService } from '../../common/mailer.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// Google issues a distinct OAuth client id per platform (Web / Android /
// iOS), and the `aud` claim of an ID token is whichever one it was minted
// for — so the API accepts a comma-separated allow-list rather than a single
// value.
function allowedGoogleAudiences(): string[] {
  return (process.env.GOOGLE_OAUTH_CLIENT_IDS ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

interface GoogleTokenInfo {
  aud?: string;
  email?: string;
  email_verified?: string; // tokeninfo returns "true" / "false" as strings
  name?: string;
  exp?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailer: MailerService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: {
          create: {
            displayName: dto.displayName,
          },
        },
      },
      include: { profile: true },
    });

    return this.issueTokens(user.id, user.email, user.profile);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Suspended by an admin (AdminUsersService.suspend) — same deletedAt
    // column self-deletion never uses (that's a real hard delete), reused
    // here as a reversible block. Checked on login and refresh, not just at
    // suspend time, since a suspension must also stop a user who wasn't
    // already logged in from getting back in.
    if (user.deletedAt) {
      throw new UnauthorizedException('This account has been suspended.');
    }

    return this.issueTokens(user.id, user.email, user.profile);
  }

  /**
   * Sign up / sign in with a Google account. The ID token is verified with
   * Google, then: an existing account with that (verified) email is signed
   * into as-is — a verified Google email is treated as proof of ownership —
   * and a brand-new email creates a passwordless `authProvider: "google"`
   * account. Never creates or overwrites a password.
   */
  async loginWithGoogle(idToken: string) {
    const { email, name } = await this.verifyGoogleToken(idToken);

    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (existing) {
      if (existing.deletedAt) {
        throw new UnauthorizedException('This account has been suspended.');
      }
      return this.issueTokens(existing.id, existing.email, existing.profile);
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        authProvider: 'google',
        profile: { create: { displayName: name ?? null } },
      },
      include: { profile: true },
    });

    return this.issueTokens(user.id, user.email, user.profile);
  }

  private async verifyGoogleToken(idToken: string): Promise<{ email: string; name?: string }> {
    const audiences = allowedGoogleAudiences();
    if (audiences.length === 0) {
      throw new ServiceUnavailableException('Google sign-in is not configured on this server.');
    }

    // tokeninfo is Google's own verification endpoint — fine for MVP volume.
    // A higher-traffic version would verify the JWT signature locally against
    // Google's cached JWKS instead of a network call per sign-in.
    let info: GoogleTokenInfo;
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!res.ok) {
        throw new UnauthorizedException('Google sign-in failed. Please try again.');
      }
      info = (await res.json()) as GoogleTokenInfo;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`Google tokeninfo lookup failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not reach Google to verify your sign-in.');
    }

    if (!info.aud || !audiences.includes(info.aud)) {
      this.logger.warn(`Google ID token has unexpected aud "${info.aud ?? ''}"`);
      throw new UnauthorizedException('Google sign-in failed.');
    }
    if (!info.email || info.email_verified !== 'true') {
      throw new UnauthorizedException('Your Google email is not verified — sign in with a password instead.');
    }

    return { email: info.email.trim().toLowerCase(), name: info.name };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { profile: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.email, user.profile);
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Always resolves the same way regardless of whether the email matches an
   * account — a different response for unknown emails would let an attacker
   * enumerate registered users.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await this.mailer.sendPasswordResetEmail(email, rawToken);
  }

  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // A password reset is a security event — force every existing session
      // to re-authenticate rather than leaving old refresh tokens valid.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokens(
    userId: string,
    email: string,
    profile: { displayName: string | null; onboardingCompletedAt: Date | null; disclaimerAcknowledgedAt: Date | null } | null,
  ) {
    const accessToken = this.jwt.sign(
      { sub: userId, email },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-insecure-secret',
        expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
      },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTtlMs = parseDurationMs(process.env.JWT_REFRESH_TTL ?? '30d');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: userId,
        email,
        displayName: profile?.displayName ?? null,
        onboardingCompletedAt: profile?.onboardingCompletedAt?.toISOString() ?? null,
        disclaimerAcknowledgedAt: profile?.disclaimerAcknowledgedAt?.toISOString() ?? null,
      },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
