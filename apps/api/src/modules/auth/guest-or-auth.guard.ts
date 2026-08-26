import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GuestSessionService } from './guest-session.service';

export interface AuthenticatedActor {
  type: 'user';
  userId: string;
  email: string;
}

export interface GuestActor {
  type: 'guest';
  sessionId: string;
  disclaimerAcknowledged: boolean;
}

export type RequestActor = AuthenticatedActor | GuestActor;

/**
 * Accepts either a real user access token or a guest session token
 * (docs/FOODPADI_AUTHENTICATION_SPEC.md). Used only on the small set of
 * endpoints that are deliberately guest-accessible (Eat Now, Cook Today) —
 * every other route keeps using the plain JwtAuthGuard, which a guest token
 * can never satisfy (different signing secret entirely).
 */
@Injectable()
export class GuestOrAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly guestSessionService: GuestSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header.');
    }
    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-insecure-secret',
      });
      if (payload.sub && payload.email) {
        const actor: AuthenticatedActor = { type: 'user', userId: payload.sub, email: payload.email };
        request.actor = actor;
        return true;
      }
    } catch {
      // Not a valid user access token — fall through to the guest check.
    }

    const guestPayload = this.guestSessionService.verify(token); // throws UnauthorizedException on failure
    const actor: GuestActor = {
      type: 'guest',
      sessionId: guestPayload.sessionId,
      disclaimerAcknowledged: guestPayload.disclaimerAcknowledged,
    };
    request.actor = actor;
    return true;
  }
}
