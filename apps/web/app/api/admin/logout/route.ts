import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '../../../../lib/adminSession';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url), { status: 303 });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
