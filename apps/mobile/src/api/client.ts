import Constants from 'expo-constants';
import type {
  AddShoppingListItemRequest,
  AuthResponse,
  AvoidedIngredientItem,
  ConfirmPasswordResetRequest,
  FoodGoalsResponse,
  FoodPreferenceItem,
  GenerateRecipesRequest,
  GeneratePlanRequest,
  GuestSessionResponse,
  ImportRecipeRequest,
  LoginRequest,
  MealPlanView,
  RecipeView,
  RegisterRequest,
  RequestPasswordResetRequest,
  SaveRecipeRequest,
  SearchEatNowRequest,
  SetFoodGoalsRequest,
  ShoppingListView,
  TrackGoalEventRequest,
  UpdateShoppingListItemRequest,
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

  // Some 200 responses (e.g. GET /plan-ahead/current with no plan yet) carry
  // an empty body rather than the literal JSON "null" — response.json() would
  // throw "Unexpected end of JSON input" on that, so parse text ourselves.
  const rawBody = await response.text();
  if (!rawBody) {
    return null as T;
  }
  return JSON.parse(rawBody) as T;
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
  getGoals: () => request<FoodGoalsResponse>('/users/me/goals', { auth: true }),
  setGoals: (payload: SetFoodGoalsRequest) =>
    request<FoodGoalsResponse>('/users/me/goals', { method: 'PUT', body: payload, auth: true }),
  trackGoalEvent: (payload: TrackGoalEventRequest) =>
    request<void>('/users/me/goals/events', { method: 'POST', body: payload, auth: true }).catch(() => undefined),
  listPreferences: () =>
    request<FoodPreferenceItem[]>('/users/me/preferences', { auth: true }),
  addPreference: (payload: UpsertFoodPreferenceRequest) =>
    request('/users/me/preferences', { method: 'POST', body: payload, auth: true }),
  deletePreference: (id: string) =>
    request<void>(`/users/me/preferences/${id}`, { method: 'DELETE', auth: true }),
  listAvoidedIngredients: () =>
    request<AvoidedIngredientItem[]>('/users/me/avoided-ingredients', { auth: true }),
  addAvoidedIngredient: (ingredientName: string) =>
    request('/users/me/avoided-ingredients', { method: 'POST', body: { ingredientName }, auth: true }),
  deleteAvoidedIngredient: (id: string) =>
    request<void>(`/users/me/avoided-ingredients/${id}`, { method: 'DELETE', auth: true }),
  exportData: () => request<Record<string, unknown>>('/users/me/export', { auth: true }),
  deleteAccount: () => request<void>('/users/me', { method: 'DELETE', auth: true }),
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
  importRecipe: (payload: ImportRecipeRequest) =>
    request<RecipeView>('/recipe-import', { method: 'POST', body: payload, auth: true }),
  searchEatNow: (payload: SearchEatNowRequest, token: string) =>
    request<never>('/eat-now/search', { method: 'POST', body: payload, token }),
  generatePlan: (payload: GeneratePlanRequest) =>
    request<MealPlanView>('/plan-ahead/generate', { method: 'POST', body: payload, auth: true }),
  getCurrentPlan: () => request<MealPlanView | null>('/plan-ahead/current', { auth: true }),
  acceptPlan: (planId: string) =>
    request<MealPlanView>(`/plan-ahead/${planId}/accept`, { method: 'POST', auth: true }),
  regeneratePlanItem: (planId: string, itemId: string) =>
    request<MealPlanView>(`/plan-ahead/${planId}/items/${itemId}/regenerate`, { method: 'POST', auth: true }),
  removePlanItem: (planId: string, itemId: string) =>
    request<MealPlanView>(`/plan-ahead/${planId}/items/${itemId}`, { method: 'DELETE', auth: true }),
  generateShoppingList: (planId: string) =>
    request<ShoppingListView>(`/plan-ahead/${planId}/shopping-list`, { method: 'POST', auth: true }),
  getShoppingList: (listId: string) =>
    request<ShoppingListView>(`/plan-ahead/shopping-lists/${listId}`, { auth: true }),
  addShoppingListItem: (listId: string, payload: AddShoppingListItemRequest) =>
    request(`/plan-ahead/shopping-lists/${listId}/items`, { method: 'POST', body: payload, auth: true }),
  updateShoppingListItem: (listId: string, itemId: string, payload: UpdateShoppingListItemRequest) =>
    request(`/plan-ahead/shopping-lists/${listId}/items/${itemId}`, { method: 'PATCH', body: payload, auth: true }),
  removeShoppingListItem: (listId: string, itemId: string) =>
    request<void>(`/plan-ahead/shopping-lists/${listId}/items/${itemId}`, { method: 'DELETE', auth: true }),
};

export { ApiError };
