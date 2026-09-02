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

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RegisterRequest;

  // "Feed a Friend": the referral code rides the httpOnly `fp_ref` cookie set
  // by middleware when the user arrived via an invite link — the register form
  // never sees or sends it. Attribution is best-effort server-side.
  const referralCode = request.cookies.get(REF_COOKIE)?.value;

  const apiRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Let the API derive a hashed signup fingerprint from the real client.
      'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
    },
    body: JSON.stringify({ ...body, ...(referralCode ? { referralCode } : {}) }),
  });

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
