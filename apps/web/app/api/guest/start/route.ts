import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  sessionCookieOptions,
} from '../../../../lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

/**
 * Starts a "try FoodPadi" guest session — called by the marketing page's
 * "Try it now" button. Mints a signed guest token from the API and stores it
 * in the httpOnly `fp_guest` cookie. No-ops if the visitor already has a real
 * session or a guest session.
 */
export async function POST(request: NextRequest) {
  if (request.cookies.get(ACCESS_COOKIE) || request.cookies.get(GUEST_COOKIE)) {
    return NextResponse.json({ ok: true });
  }

  const apiRes = await fetch(`${API_URL}/auth/guest-session`, { method: 'POST' }).catch(() => null);
  if (!apiRes || !apiRes.ok) {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const { guestToken } = (await apiRes.json()) as { guestToken: string };
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GUEST_COOKIE, guestToken, sessionCookieOptions(GUEST_COOKIE_MAX_AGE));
  return response;
}
