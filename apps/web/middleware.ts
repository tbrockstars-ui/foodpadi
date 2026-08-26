import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  sessionCookieOptions,
} from './lib/session';

export const config = {
  matcher: ['/plan/:path*', '/shopping-list/:path*', '/api/proxy/:path*'],
};

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

/**
 * Closes a real gap: nothing in this codebase (mobile included) ever calls
 * /auth/refresh today, so access tokens silently expire after ~15-20 min.
 * Server Components can't set cookies mid-render, so the refresh has to
 * happen here, before the page/route runs, on every request to a protected
 * path — not in serverApi.ts or the proxy route.
 */
export async function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (access || !refresh) {
    // Either the access cookie is still present (assume fresh enough for
    // this request), or there's no refresh token to use — nothing to do
    // here; the page/proxy will 401 and redirect to /login if truly invalid.
    return NextResponse.next();
  }

  try {
    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!refreshRes.ok) {
      const response = NextResponse.next();
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }

    const data = (await refreshRes.json()) as { accessToken: string; refreshToken: string };

    // Update the request's own cookies too, so this same request's
    // downstream Server Component/Route Handler sees the fresh token —
    // not just the *next* request from the browser.
    request.cookies.set(ACCESS_COOKIE, data.accessToken);
    request.cookies.set(REFRESH_COOKIE, data.refreshToken);

    const response = NextResponse.next({ request });
    response.cookies.set(ACCESS_COOKIE, data.accessToken, sessionCookieOptions(ACCESS_COOKIE_MAX_AGE));
    response.cookies.set(REFRESH_COOKIE, data.refreshToken, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));
    return response;
  } catch {
    // API unreachable — let the request through as unauthenticated rather
    // than hard-failing the whole page load.
    return NextResponse.next();
  }
}
