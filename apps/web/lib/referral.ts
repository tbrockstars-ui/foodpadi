// "Feed a Friend" referral link handling (docs/REFERRAL_PLAN.md, Phase 1a).

export const REF_COOKIE = 'fp_ref';

// 90 days: long enough that a friend who clicks an invite link today and comes
// back to register next week is still attributed, short enough that a shared
// device doesn't carry a stale code indefinitely.
export const REF_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

/** Codes are [2-9A-Z] minus ambiguous chars; be lenient on length here and let
 * the API be the authority on whether a code actually resolves. */
const CODE_PATTERN = /^[A-Za-z0-9]{4,32}$/;

/** Sanitise a raw `?ref=` query value before it goes anywhere near a cookie. */
export function sanitizeRefParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return CODE_PATTERN.test(trimmed) ? trimmed.toUpperCase() : null;
}

export function refCookieOptions(maxAge: number = REF_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
