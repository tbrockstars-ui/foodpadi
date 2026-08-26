import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'dev-only-insecure-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // Guest tokens are signed with a different secret entirely, so they
    // already fail signature verification before reaching here — this is a
    // second, explicit check against a malformed/unexpected payload shape.
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid access token.');
    }
    return { userId: payload.sub, email: payload.email };
  }
}
