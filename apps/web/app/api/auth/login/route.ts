import { NextRequest, NextResponse } from 'next/server';
import type { AuthResponse, LoginRequest } from '@foodpadi/shared';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  GUEST_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  sessionCookieOptions,
} from '../../../../lib/session';

// 127.0.0.1, not "localhost": the NestJS API binds 0.0.0.0 (IPv4 only), and
// on Windows "localhost" often resolves to ::1 first — a fetch that lands on
// IPv6 gets ECONNREFUSED.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4310';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginRequest;

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // API process is down / restarting / unreachable — return a clean 503
    // the form can show, not an unhandled throw that becomes an opaque 500
    // and the generic "something went wrong".
    console.error(`[api-auth] login: upstream fetch to ${API_URL} failed:`, e);
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
  return response;
}
