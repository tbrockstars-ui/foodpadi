export const ACCESS_COOKIE = 'fp_access';
export const REFRESH_COOKIE = 'fp_refresh';

// Access tokens live 15 minutes (JWT_ACCESS_TTL); give the cookie a little
// slack over that so it doesn't expire mid-request, but let the refresh
// flow (serverApi.ts) be the thing that actually rotates it.
export const ACCESS_COOKIE_MAX_AGE = 20 * 60;
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
