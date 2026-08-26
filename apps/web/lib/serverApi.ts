import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from './session';

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
  try {
    const parsed = JSON.parse(rawBody) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join('. ');
    if (typeof parsed.message === 'string') return parsed.message;
    return null;
  } catch {
    return rawBody;
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

export function requireSession(nextPath: string): void {
  if (!isAuthenticated()) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
}
