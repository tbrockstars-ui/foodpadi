import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from './session';
import { getGuestToken, hasGuestSession } from './guestSession';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// NestJS error bodies are JSON ({ message: string | string[], error, statusCode }) —
// mirrors apps/mobile/src/api/client.ts's extractErrorMessage.
function extractErrorMessage(rawBody: string): string | null {
  if (!rawBody) return null;
  const trimmed = rawBody.trim();
  // A CDN / gateway error (Render 502/503, Cloudflare 520-524) returns a full
  // HTML page, not our JSON error shape — never surface markup as a message.
  if (trimmed.startsWith('<')) return null;
  try {
    const parsed = JSON.parse(trimmed) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join('. ');
    if (typeof parsed.message === 'string') return parsed.message;
    return null;
  } catch {
    // Plain-text non-JSON body — keep it only if it's short enough to be a
    // real message, not a dumped document or stack trace.
    return trimmed.length <= 200 ? trimmed : null;
  }
}

/**
 * Server-side fetch for use in Server Components. Assumes middleware.ts has
 * already refreshed the access cookie if it was refreshable — this function
 * does not itself retry on 401, since Server Components can't set cookies
 * mid-render (a Next.js constraint). Callers should treat a 401 ApiError as
 * "not authenticated" and redirect.
 */
export async function serverFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const rawBody = await res.text();
    throw new ApiError(res.status, extractErrorMessage(rawBody) ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const rawBody = await res.text();
  return rawBody ? (JSON.parse(rawBody) as T) : (null as T);
}

export function isAuthenticated(): boolean {
  return !!cookies().get(ACCESS_COOKIE)?.value;
}

/** True for an anonymous visitor who has started a "try FoodPadi" guest session. */
export function isGuest(): boolean {
  return !isAuthenticated() && hasGuestSession();
}

export function requireSession(nextPath: string): void {
  if (!isAuthenticated()) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
}

/**
 * Call from a protected page's `catch` block. A 401 from serverFetch means
 * the stored session is stale (access token expired) rather than a network
 * problem — `requireSession` let the request through because the cookie is
 * still *present*, and middleware only refreshes once it's gone. Bounce
 * through login (which re-auths or uses the refresh token) instead of
 * leaving the user on a dead-end "check your connection" screen they can
 * never clear. Must be called from the catch block itself, not inside the
 * try — `redirect()` throws a NEXT_REDIRECT that a surrounding `catch {}`
 * would swallow.
 */
export function redirectToLoginIfUnauthorized(error: unknown, nextPath: string): void {
  if (error instanceof ApiError && error.status === 401) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
}

/**
 * For the guest-accessible pages (Eat Now, Cook Today, Plan Ahead preview):
 * a real account OR a guest session is fine; a truly anonymous visitor is
 * sent to log in. Guest sessions are normally minted by middleware before the
 * page renders, so this mostly guards the "API was unreachable at mint time"
 * edge.
 */
export function requireSessionOrGuest(nextPath: string): void {
  if (!isAuthenticated() && !hasGuestSession()) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
}

/**
 * Server-side fetch that sends the guest token (Server Components can read the
 * httpOnly cookie; the browser can't reach the API cross-origin, so client
 * components go through /api/proxy instead). Same no-retry contract as
 * serverFetch.
 */
export async function guestFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getGuestToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const rawBody = await res.text();
    throw new ApiError(res.status, extractErrorMessage(rawBody) ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const rawBody = await res.text();
  return rawBody ? (JSON.parse(rawBody) as T) : (null as T);
}
