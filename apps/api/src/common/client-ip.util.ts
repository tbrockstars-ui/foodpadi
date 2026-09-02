import type { Request } from 'express';

/**
 * Best-effort client IP. The web app reaches the API server-to-server, so
 * `req.ip` would be the Next.js server — the register/google route handlers
 * forward the browser's `x-forwarded-for`, and we take its first hop here.
 * Only ever used to derive a hashed signup fingerprint for manual abuse
 * review (docs/PRIVACY_DATA_MODEL.md), never for automated blocking, so an
 * imperfect value is acceptable.
 */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || req.ip || null;
}
