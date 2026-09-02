import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  GUEST_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  sessionCookieOptions,
} from '../../../../lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

/**
 * Generic authenticated proxy so client components never need per-endpoint
 * Route Handlers — they call /api/proxy/<nestjs-path> and this forwards it
 * with the session's access token attached. The httpOnly cookie can't be
 * sent by the browser directly to the NestJS API (different origin/port),
 * so every client-side call goes through here instead.
 *
 * Access tokens outlive by design only ~15 min; the matching refresh in
 * middleware.ts only fires once the access cookie is *gone*, so there's a
 * window where the cookie is still present but the token behind it has
 * expired and the API answers 401. This handler closes that window: on a
 * 401 it refreshes with the refresh cookie, replays the original request
 * once, and writes the rotated cookies onto its own response (a Route
 * Handler can set cookies mid-request; a Server Component can't, which is
 * why serverApi.ts leaves this to middleware instead).
 */
async function callApi(targetPath: string, search: string, method: string, body: string | undefined, accessToken: string | undefined) {
  return fetch(`${API_URL}/${targetPath}${search}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
  });
}

async function forward(request: NextRequest, path: string[]) {
  const jar = cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  // Fall back to the guest token when there's no real session. The API's
  // GuestOrAuthGuard routes (Eat Now, Cook Today/Decide, plan preview) accept
  // it; a JwtAuthGuard-only route (save recipe, generate plan, scan) will
  // 401 it and the client bounces to signup, which is the intended behaviour.
  const guestToken = jar.get(GUEST_COOKIE)?.value;
  const bearer = accessToken ?? guestToken;
  const targetPath = path.join('/');
  const search = request.nextUrl.search;
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

  let apiRes = await callApi(targetPath, search, request.method, body, bearer);

  // Refresh-and-retry once on an expired access token. Skip entirely when
  // there's no refresh token, or when the caller never had an access token
  // (a genuinely anonymous request — nothing to refresh).
  let rotated: { accessToken: string; refreshToken: string } | null = null;
  if (apiRes.status === 401 && refreshToken && accessToken) {
    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      rotated = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
      apiRes = await callApi(targetPath, search, request.method, body, rotated.accessToken);
    } else {
      // Refresh token itself is dead (expired, revoked, or lost a rotation
      // race) — clear the stale session so the next navigation lands on
      // /login rather than silently retrying a doomed token forever.
      const cleared = new NextResponse(await refreshRes.text().catch(() => null), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
      cleared.cookies.delete(ACCESS_COOKIE);
      cleared.cookies.delete(REFRESH_COOKIE);
      return cleared;
    }
  }

  const responseBody = await apiRes.text();
  const response = new NextResponse(responseBody || null, {
    status: apiRes.status,
    headers: { 'Content-Type': apiRes.headers.get('Content-Type') ?? 'application/json' },
  });
  if (rotated) {
    response.cookies.set(ACCESS_COOKIE, rotated.accessToken, sessionCookieOptions(ACCESS_COOKIE_MAX_AGE));
    response.cookies.set(REFRESH_COOKIE, rotated.refreshToken, sessionCookieOptions(REFRESH_COOKIE_MAX_AGE));
  }
  return response;
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
