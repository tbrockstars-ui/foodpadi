import Constants from 'expo-constants';
import type {
  AuthResponse,
  ConfirmPasswordResetRequest,
  GenerateRecipesRequest,
  GuestSessionResponse,
  LoginRequest,
  RecipeView,
  RegisterRequest,
  RequestPasswordResetRequest,
  SaveRecipeRequest,
  UpsertFoodPreferenceRequest,
  UserSummary,
} from '@foodpadi/shared';
import { tokenStore } from './tokenStore';

const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:4310';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// NestJS error bodies are JSON ({ message: string | string[], error, statusCode }),
// not plain text — surfacing the raw body (as this used to) shows the user
// a literal JSON blob instead of a sentence. class-validator in particular
// returns an array of per-field messages.
function extractErrorMessage(rawBody: string): string | null {
  if (!rawBody) return null;
  try {
    const parsed = JSON.parse(rawBody) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join('. ');
    }
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
    return null;
  } catch {
    return rawBody;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  } else if (options.auth) {
    const accessToken = await tokenStore.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const rawBody = await response.text();
    throw new ApiError(response.status, extractErrorMessage(rawBody) ?? response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  register: (payload: RegisterRequest) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: payload }),
  login: (payload: LoginRequest) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: payload }),
  me: () => request<UserSummary>('/users/me', { auth: true }),
  acknowledgeDisclaimer: () =>
    request<UserSummary>('/users/me/disclaimer-acknowledge', { method: 'POST', auth: true }),
  completeOnboarding: () =>
    request<UserSummary>('/users/me/complete-onboarding', { method: 'POST', auth: true }),
  setGoal: (goalType: string) =>
    request('/users/me/goal', { method: 'PUT', body: { goalType }, auth: true }),
  addPreference: (payload: UpsertFoodPreferenceRequest) =>
    request('/users/me/preferences', { method: 'POST', body: payload, auth: true }),
  requestPasswordReset: (payload: RequestPasswordResetRequest) =>
    request<void>('/auth/password-reset/request', { method: 'POST', body: payload }),
  confirmPasswordReset: (payload: ConfirmPasswordResetRequest) =>
    request<void>('/auth/password-reset/confirm', { method: 'POST', body: payload }),
  createGuestSession: () =>
    request<GuestSessionResponse>('/auth/guest-session', { method: 'POST' }),
  acknowledgeGuestDisclaimer: (guestToken: string) =>
    request<GuestSessionResponse>('/auth/guest-session/disclaimer-acknowledge', {
      method: 'POST',
      body: { guestToken },
    }),
  generateCookTodayRecipes: (payload: GenerateRecipesRequest, token: string) =>
    request<RecipeView[]>('/cook-today/generate', { method: 'POST', body: payload, token }),
  saveRecipe: (payload: SaveRecipeRequest) =>
    request('/cook-today/recipes', { method: 'POST', body: payload, auth: true }),
};

export { ApiError };
