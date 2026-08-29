import crypto from 'crypto';

export const ADMIN_SESSION_COOKIE = 'foodpadi_admin_session';

export interface AdminStaffIdentity {
  username: string;
  displayName: string | null;
}

/**
 * Real per-person staff authentication for the admin console: the cookie is
 * an HMAC-signed `<base64url payload>.<signature>` carrying which staff
 * member is signed in (apps/api's AdminStaffUser table, checked via
 * POST /admin/auth/login), replacing the earlier single-shared-code
 * placeholder. Admin actions are now attributable to a specific staff
 * member, not just "someone with the code" — see docs/IMPLEMENTATION_PLAN.md.
 */
function getSigningSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not set.');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
}

export function createAdminSessionToken(staff: AdminStaffIdentity): string {
  const payload = Buffer.from(JSON.stringify(staff)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined): AdminStaffIdentity | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed?.username !== 'string') return null;
    return { username: parsed.username, displayName: parsed.displayName ?? null };
  } catch {
    return null;
  }
}

export function isValidAdminSessionToken(token: string | undefined): boolean {
  return verifyAdminSessionToken(token) !== null;
}
