export const ACCESS_COOKIE = 'fp_access';
export const REFRESH_COOKIE = 'fp_refresh';

// Access tokens live 15 minutes (JWT_ACCESS_TTL). Keep the cookie's lifetime
// the same — an earlier version gave it 5 min of "slack" over the token,
// which created a window where the cookie looked valid to middleware.ts (so
// it skipped the refresh) but the token inside had already expired and the
// API answered 401. Two things now rotate the token: middleware.ts refreshes
// once the cookie is gone, and the /api/proxy route refreshes-and-retries
// when the cookie is still present but the API rejects the token.
export const ACCESS_COOKIE_MAX_AGE = 15 * 60;
export const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches JWT_REFRESH_TTL

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
