import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from './adminSession';

const API_URL = process.env.API_URL ?? 'http://localhost:4310';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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

/** Admin counterpart to lib/serverApi.ts's serverFetch — for Server
 * Components under /admin, calling the API directly with the service-to-
 * service admin secret instead of a user's Bearer token. */
export async function adminServerFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const adminApiSecret = process.env.ADMIN_API_SECRET;
  if (!adminApiSecret) {
    throw new ApiError(503, 'Admin API is not configured.');
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Api-Secret': adminApiSecret,
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

export function requireAdminSession(): void {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  if (!isValidAdminSessionToken(token)) {
    redirect('/admin/login');
  }
}
