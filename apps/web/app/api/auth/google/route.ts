import { NextRequest, NextResponse } from 'next/server';
import type { AuthResponse, GoogleAuthRequest } from '@foodpadi/shared';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  sessionCookieOptions,
} from '../../../../lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

// Mirror of the register/login routes: forwards the Google ID token to the
// API, then sets the httpOnly session cookies from the AuthResponse.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as GoogleAuthRequest;

  const apiRes = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawBody = await apiRes.text();
  if (!apiRes.ok) {
    return new NextResponse(rawBody, { status: apiRes.status, headers: { 'Content-Type': 'application/json' } });
  }

  const data = JSON.parse(rawBody) as AuthResponse;
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(ACCESS_COOKIE, data.accessToken, sessionCookieOptions(ACCESS_COOKIE_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));
  return response;
}
