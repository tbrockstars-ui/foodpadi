import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  sessionCookieOptions,
} from './lib/session';
import { REF_COOKIE, refCookieOptions, sanitizeRefParam } from './lib/referral';

export const config = {
  // `/`, `/register`, `/login` are here for referral capture only (see
  // captureReferral). `/invite`, `/plan`, `/shopping-list`, `/api/proxy` are
  // the session-refresh paths. `/eat-now`, `/cook-today` (+ `/plan`) also
  // mint a guest session for an anonymous visitor (see maybeStartGuestSession).
  matcher: [
    '/',
    '/register',
    '/login',
    '/invite',
    '/eat-now/:path*',
    '/cook-today/:path*',
    '/plan/:path*',
    '/shopping-list/:path*',
    '/api/proxy/:path*',
  ],
};

// Anonymous visitors to these get a "try FoodPadi" guest session minted so a
// bookmarked/shared link just works. Exact matches only — the sub-pages
// (`/cook-today/saved`, `/plan/saved`, …) are genuinely account-only. `/` is
// excluded too: it stays the marketing page until the visitor clicks
// "Try it now" (/api/guest/start).
const GUEST_PAGES = new Set(['/eat-now', '/cook-today', '/plan']);

function isGuestEligiblePage(pathname: string): boolean {
  return GUEST_PAGES.has(pathname);
}

async function maybeStartGuestSession(request: NextRequest): Promise<NextResponse | null> {
  if (!isGuestEligiblePage(request.nextUrl.pathname)) return null;
  if (
    request.cookies.get(ACCESS_COOKIE) ||
    request.cookies.get(REFRESH_COOKIE) ||
    request.cookies.get(GUEST_COOKIE)
  ) {
    return null;
  }
  try {
    const res = await fetch(`${API_URL}/auth/guest-session`, { method: 'POST' });
    if (!res.ok) return null;
    const { guestToken } = (await res.json()) as { guestToken: string };
    // Set on the request too, so this same render sees the guest session.
    request.cookies.set(GUEST_COOKIE, guestToken);
    const response = NextResponse.next({ request });
    response.cookies.set(GUEST_COOKIE, guestToken, sessionCookieOptions(GUEST_COOKIE_MAX_AGE));
    return response;
  } catch {
    // API unreachable — fall through; requireSessionOrGuest sends them to login.
    return null;
  }
}

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

/**
 * "Feed a Friend": a visitor arriving on `foodpadi.app/?ref=CODE` gets the
 * code stored in a first-party cookie and the query param stripped from the
 * URL (so it doesn't linger in history or get re-shared). First touch wins —
 * an existing `fp_ref` cookie is never overwritten. The register/google route
 * handlers read this cookie and attach it to the signup. Independent of
 * whether the visitor lands on the waitlist page or (later) a guest flow.
 */
function captureReferral(request: NextRequest): NextResponse | null {
  const raw = request.nextUrl.searchParams.get('ref');
  if (raw === null) return null;

  const url = request.nextUrl.clone();
  url.searchParams.delete('ref');
  const response = NextResponse.redirect(url);

  const code = sanitizeRefParam(raw);
  if (code && !request.cookies.get(REF_COOKIE)) {
    response.cookies.set(REF_COOKIE, code, refCookieOptions());
  }
  return response;
}

/**
 * Closes a real gap: nothing in this codebase (mobile included) ever calls
 * /auth/refresh today, so access tokens silently expire after ~15-20 min.
 * Server Components can't set cookies mid-render, so the refresh has to
 * happen here, before the page/route runs, on every request to a protected
 * path — not in serverApi.ts or the proxy route.
 */
export async function middleware(request: NextRequest) {
  const referralRedirect = captureReferral(request);
  if (referralRedirect) return referralRedirect;

  const guestStart = await maybeStartGuestSession(request);
  if (guestStart) return guestStart;

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
