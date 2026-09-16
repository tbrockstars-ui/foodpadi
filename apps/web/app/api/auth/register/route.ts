import { NextRequest, NextResponse } from 'next/server';
import type { AuthResponse, RegisterRequest } from '@foodpadi/shared';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  GUEST_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  sessionCookieOptions,
} from '../../../../lib/session';
import { REF_COOKIE } from '../../../../lib/referral';

// 127.0.0.1, not "localhost": the NestJS API binds 0.0.0.0 (IPv4 only), and
// on Windows "localhost" often resolves to ::1 first — a fetch that lands on
// IPv6 gets ECONNREFUSED.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4310';

/** "en-GB,en;q=0.9" -> "GB". A fallback only — the form's picker is primary. */
function countryFromAcceptLanguage(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(',')) {
    const m = /^[a-zA-Z]{2,3}-([A-Za-z]{2})/.exec(part.trim());
    if (m) return m[1].toUpperCase();
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RegisterRequest;

  // "Feed a Friend": the referral code rides the httpOnly `fp_ref` cookie set
  // by middleware when the user arrived via an invite link — the register form
  // never sees or sends it. Attribution is best-effort server-side.
  const referralCode = request.cookies.get(REF_COOKIE)?.value;

  // Country of residence normally comes from the form's picker; fall back to
  // the Accept-Language region so it's rarely empty (the user can correct it
  // later on the paywall / profile).
  const countryCode = body.countryCode || countryFromAcceptLanguage(request.headers.get('accept-language'));

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Let the API derive a hashed signup fingerprint from the real client.
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify({
        ...body,
        ...(referralCode ? { referralCode } : {}),
        ...(countryCode ? { countryCode } : {}),
      }),
    });
  } catch (e) {
    // API process is down / restarting / unreachable — return a clean 503
    // the form can show, not an unhandled throw that becomes an opaque 500
    // and the generic "something went wrong".
    console.error(`[api-auth] register: upstream fetch to ${API_URL} failed:`, e);
    return NextResponse.json(
      { message: 'The server is temporarily unavailable. Please try again in a moment.' },
      { status: 503 },
    );
  }

  const rawBody = await apiRes.text();
  if (!apiRes.ok) {
    return new NextResponse(rawBody, { status: apiRes.status, headers: { 'Content-Type': 'application/json' } });
  }

  const data = JSON.parse(rawBody) as AuthResponse;
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(ACCESS_COOKIE, data.accessToken, sessionCookieOptions(ACCESS_COOKIE_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));
  // Any prior guest session is spent — the real account supersedes it.
  response.cookies.delete(GUEST_COOKIE);
  // One referral code is spent on one signup — clear it so a shared browser
  // doesn't attribute the next person who registers to the same referrer.
  if (referralCode) response.cookies.delete(REF_COOKIE);
  return response;
}
