import Constants from 'expo-constants';
import type {
  AuthResponse,
  ConfirmPasswordResetRequest,
  LoginRequest,
  RegisterRequest,
  RequestPasswordResetRequest,
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

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (options.auth) {
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
    const message = await response.text();
    throw new ApiError(response.status, message || response.statusText);
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
  requestPasswordReset: (payload: RequestPasswordResetRequest) =>
    request<void>('/auth/password-reset/request', { method: 'POST', body: payload }),
  confirmPasswordReset: (payload: ConfirmPasswordResetRequest) =>
    request<void>('/auth/password-reset/confirm', { method: 'POST', body: payload }),
};

export { ApiError };
