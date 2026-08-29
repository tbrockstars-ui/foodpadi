import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from '../../../../lib/adminSession';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

/**
 * Admin counterpart to /api/proxy — same "client components hit this instead
 * of the NestJS API directly" shape, but gated on the admin session cookie
 * (not a customer session) and forwards a server-to-server secret
 * (ADMIN_API_SECRET) instead of a user's Bearer token. The secret never
 * reaches the browser; only this route handler (and AdminApiGuard on the API
 * side) ever see it. See apps/api/src/modules/admin/admin-api.guard.ts and
 * apps/web/README.md's "Admin auth is a placeholder" note — this proves the
 * request came from the gated /admin area, not which staff member sent it.
 */
async function forward(request: NextRequest, path: string[]) {
  const adminToken = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  if (!isValidAdminSessionToken(adminToken)) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });
  }

  const adminApiSecret = process.env.ADMIN_API_SECRET;
  if (!adminApiSecret) {
    return NextResponse.json({ message: 'Admin API is not configured.' }, { status: 503 });
  }

  const targetPath = path.join('/');
  const search = request.nextUrl.search;
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

  const apiRes = await fetch(`${API_URL}/${targetPath}${search}`, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Api-Secret': adminApiSecret,
    },
    body,
  });

  const responseBody = await apiRes.text();
  return new NextResponse(responseBody || null, {
    status: apiRes.status,
    headers: { 'Content-Type': apiRes.headers.get('Content-Type') ?? 'application/json' },
  });
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
