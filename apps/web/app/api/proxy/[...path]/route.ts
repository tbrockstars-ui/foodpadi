import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '../../../../lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

/**
 * Generic authenticated proxy so client components never need per-endpoint
 * Route Handlers — they call /api/proxy/<nestjs-path> and this forwards it
 * with the session's access token attached. The httpOnly cookie can't be
 * sent by the browser directly to the NestJS API (different origin/port),
 * so every client-side call goes through here instead.
 */
async function forward(request: NextRequest, path: string[]) {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  const targetPath = path.join('/');
  const search = request.nextUrl.search;
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

  const apiRes = await fetch(`${API_URL}/${targetPath}${search}`, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path);
}
