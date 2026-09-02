import { cookies } from 'next/headers';
import { GUEST_COOKIE } from './session';

/**
 * Guest-session helpers for Server Components / Route Handlers. The guest JWT
 * lives in the httpOnly `fp_guest` cookie (minted by middleware or
 * /api/guest/start). We never verify the signature here — the API does that
 * on every request — these only read the payload for render-time hints
 * (is this a guest? has the disclaimer been acknowledged yet?).
 */

export interface GuestState {
  disclaimerAcknowledged: boolean;
}

export function getGuestToken(): string | undefined {
  return cookies().get(GUEST_COOKIE)?.value;
}

export function hasGuestSession(): boolean {
  return !!getGuestToken();
}

/** Decode the JWT payload without verifying — display hint only. */
export function getGuestState(): GuestState | null {
  const token = getGuestToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || payload.kind !== 'guest') return null;
  return { disclaimerAcknowledged: payload.disclaimerAcknowledged === true };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
