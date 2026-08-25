import crypto from 'crypto';

export const ADMIN_SESSION_COOKIE = 'foodpadi_admin_session';

/**
 * Placeholder admin auth for Phase 1 scaffolding only: a single shared
 * access code (ADMIN_ACCESS_CODE) HMAC-signed into a cookie so it can't be
 * forged by guessing a flag value, but it is NOT real staff authentication.
 *
 * Before any real admin/support data is exposed here, this must be replaced
 * with per-person staff accounts (see docs/TECHNICAL_ARCHITECTURE.md §2.7 —
 * admin auth must stay entirely separate from end-user auth) — tracked as a
 * Phase 1 follow-up, not deferred silently.
 */
function getSigningSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not set.');
  }
  return secret;
}

export function createAdminSessionToken(): string {
  return crypto.createHmac('sha256', getSigningSecret()).update('admin-authenticated').digest('hex');
}

export function isValidAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = createAdminSessionToken();
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  if (tokenBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function verifyAccessCode(candidate: string): boolean {
  const configured = process.env.ADMIN_ACCESS_CODE;
  if (!configured) return false;
  const candidateBuffer = Buffer.from(candidate);
  const configuredBuffer = Buffer.from(configured);
  if (candidateBuffer.length !== configuredBuffer.length) return false;
  return crypto.timingSafeEqual(candidateBuffer, configuredBuffer);
}
