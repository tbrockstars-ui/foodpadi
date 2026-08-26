import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

export interface GuestTokenPayload {
  kind: 'guest';
  sessionId: string;
  disclaimerAcknowledged: boolean;
}

const GUEST_TOKEN_TTL = process.env.JWT_GUEST_TTL ?? '24h';

/**
 * Guest sessions are not a User row (docs/FOODPADI_AUTHENTICATION_SPEC.md).
 * They're a short-lived, signed, opaque token used only to rate-limit guest
 * AI calls and record disclaimer acknowledgement — never to persist
 * preferences, memory, or plans. Signed with its own secret so a guest token
 * can never be mistaken for (or forged as) a real user access token.
 */
@Injectable()
export class GuestSessionService {
  constructor(private readonly jwt: JwtService) {}

  issue(disclaimerAcknowledged = false): string {
    const payload: GuestTokenPayload = {
      kind: 'guest',
      sessionId: crypto.randomUUID(),
      disclaimerAcknowledged,
    };
    return this.sign(payload);
  }

  acknowledgeDisclaimer(rawToken: string): string {
    const payload = this.verify(rawToken);
    // Rebuild a clean payload rather than spreading the verified one — the
    // decoded token also carries jwt's own `iat`/`exp` claims, and jsonwebtoken
    // refuses to sign a payload that already has `exp` alongside an
    // `expiresIn` option.
    return this.sign({
      kind: 'guest',
      sessionId: payload.sessionId,
      disclaimerAcknowledged: true,
    });
  }

  verify(rawToken: string): GuestTokenPayload {
    try {
      const payload = this.jwt.verify<GuestTokenPayload>(rawToken, {
        secret: this.getSecret(),
      });
      if (payload.kind !== 'guest') {
        throw new UnauthorizedException('Not a guest token.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired guest session.');
    }
  }

  private sign(payload: GuestTokenPayload): string {
    return this.jwt.sign(payload, { secret: this.getSecret(), expiresIn: GUEST_TOKEN_TTL });
  }

  private getSecret(): string {
    return process.env.JWT_GUEST_SECRET ?? 'dev-only-insecure-guest-secret';
  }
}
