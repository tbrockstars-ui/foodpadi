import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, verifyAccessCode } from '../../../../lib/adminSession';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const accessCode = String(formData.get('accessCode') ?? '');

  if (!verifyAccessCode(accessCode)) {
    const url = new URL('/admin/login?error=1', request.url);
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(new URL('/admin', request.url), { status: 303 });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return response;
}
