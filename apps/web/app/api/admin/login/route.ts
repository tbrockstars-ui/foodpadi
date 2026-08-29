import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from '../../../../lib/adminSession';
import { adminServerFetch, ApiError } from '../../../../lib/adminApi';

interface AdminStaffUserView {
  id: string;
  username: string;
  displayName: string | null;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  try {
    const staff = await adminServerFetch<AdminStaffUserView>('/admin/auth/login', {
      method: 'POST',
      body: { username, password },
    });

    const response = NextResponse.redirect(new URL('/admin', request.url), { status: 303 });
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      createAdminSessionToken({ username: staff.username, displayName: staff.displayName }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 8, // 8 hours
      },
    );
    return response;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const url = new URL('/admin/login?error=1', request.url);
      return NextResponse.redirect(url, { status: 303 });
    }
    throw e;
  }
}
