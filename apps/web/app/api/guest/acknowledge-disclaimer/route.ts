import { NextRequest, NextResponse } from 'next/server';
import { GUEST_COOKIE, GUEST_COOKIE_MAX_AGE, sessionCookieOptions } from '../../../../lib/session';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

/**
 * Records a guest's food/safety disclaimer acknowledgement. The API rotates
 * the guest token to one carrying `disclaimerAcknowledged: true`; we write it
 * back to the `fp_guest` cookie. Web counterpart of the mobile
 * GuestSessionContext.acknowledgeDisclaimer().
 */
export async function POST(request: NextRequest) {
  const guestToken = request.cookies.get(GUEST_COOKIE)?.value;
  if (!guestToken) {
    return NextResponse.json({ ok: false, message: 'No guest session.' }, { status: 401 });
  }

  const apiRes = await fetch(`${API_URL}/auth/guest-session/disclaimer-acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestToken }),
  }).catch(() => null);

  if (!apiRes || !apiRes.ok) {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const { guestToken: rotated } = (await apiRes.json()) as { guestToken: string };
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GUEST_COOKIE, rotated, sessionCookieOptions(GUEST_COOKIE_MAX_AGE));
  return response;
}
