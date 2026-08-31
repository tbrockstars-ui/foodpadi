import Constants from 'expo-constants';
import type {
  AddPantryItemsRequest,
  AddPantryItemsResponse,
  AddShoppingListItemRequest,
  AuthResponse,
  AvoidedIngredientItem,
  ConfirmPasswordResetRequest,
  DecideRequest,
  DecideResponse,
  FoodGoalsResponse,
  FoodIdeaView,
  FoodPreferenceItem,
  GenerateRecipesRequest,
  GeneratePlanRequest,
  GuestSessionResponse,
  ImportRecipeRequest,
  LocalFoodSearchRequest,
  LocalFoodSearchResponse,
  LoginRequest,
  MealPlanView,
  RecipeView,
  RegisterRequest,
  RequestPasswordResetRequest,
  SavedRecipeView,
  SaveRecipeRequest,
  ScanFoodContentRequest,
  ScanFoodContentResponse,
  ScanPhotoRequest,
  ScanPhotoResponse,
  SearchEatNowRequest,
  SetFoodGoalsRequest,
  ShoppingListView,
  TrackGoalEventRequest,
  UpdateMealPlanItemRequest,
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

function rawFetch(path: string, method: string, headers: Record<string, string>, body: unknown) {
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Not wrapped in request() below — this must never itself trigger the
// refresh-and-retry logic (infinite recursion if the refresh token is also
// dead), so it does its own raw fetch + error handling.
async function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
  const response = await rawFetch('/auth/refresh', 'POST', { 'Content-Type': 'application/json' }, { refreshToken });
  if (!response.ok) {
    const rawBody = await response.text();
    throw new ApiError(response.status, extractErrorMessage(rawBody) ?? response.statusText);
  }
  return response.json() as Promise<AuthResponse>;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; token?: string } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  } else if (options.auth) {
    const accessToken = await tokenStore.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  let response = await rawFetch(path, method, headers, options.body);

  // Access tokens live only ~15 min (JWT_ACCESS_TTL) — web's proxy already
  // refreshes-and-retries once on an expired one (apps/web/app/api/proxy/
  // [...path]/route.ts); this was missing here, so any session older than
  // 15 min hit a 401 on its next call. Worse, GuestOrAuthGuard's fallback
  // logic (try a user token, then fall through to guest-token verification)
  // means an expired *user* token surfaces as "Invalid or expired guest
  // session" — a confusing message for someone who is, in fact, logged in.
  // Gated on a stored refresh token existing at all: a guest-flow call (no
  // logged-in user, so no refresh token ever stored) correctly skips this
  // and falls through to the normal error below, leaving each screen's own
  // guest-session-recovery logic (e.g. EatNowScreen's) untouched.
  if (response.status === 401 && (options.auth || options.token)) {
    const refreshToken = await tokenStore.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        await tokenStore.setTokens(refreshed.accessToken, refreshed.refreshToken);
        const retryHeaders = { ...headers, Authorization: `Bearer ${refreshed.accessToken}` };
        response = await rawFetch(path, method, retryHeaders, options.body);
      } catch {
        // The refresh token itself is dead (expired, revoked, or lost a
        // rotation race) — clear the stale session rather than keep
        // retrying a doomed token on every call. The original 401 response
        // is left to fall through to the normal error handling below.
        await tokenStore.clear();
      }
    }
  }

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
  // Sign up / sign in with Google — `idToken` from expo-auth-session; the API
  // verifies it and finds-or-creates the user.
  googleAuth: (idToken: string) =>
    request<AuthResponse>('/auth/google', { method: 'POST', body: { idToken } }),
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
  listSavedRecipes: () => request<SavedRecipeView[]>('/cook-today/recipes', { auth: true }),
  deleteSavedRecipe: (id: string) =>
    request<void>(`/cook-today/recipes/${id}`, { method: 'DELETE', auth: true }),
  importRecipe: (payload: ImportRecipeRequest) =>
    request<RecipeView>('/recipe-import', { method: 'POST', body: payload, auth: true }),
  searchEatNow: (payload: SearchEatNowRequest, token: string) =>
    request<FoodIdeaView[]>('/eat-now/search', { method: 'POST', body: payload, token }),
  // Guest-or-auth, same as searchEatNow/localFoodSearch — the unified
  // "FoodPadi decides" entry point (web counterpart: apps/web/app/DecideFlow.tsx).
  decide: (payload: DecideRequest, token: string) =>
    request<DecideResponse>('/decide', { method: 'POST', body: payload, token }),
  localFoodSearch: (payload: LocalFoodSearchRequest, token: string) =>
    request<LocalFoodSearchResponse>('/local-food-search', { method: 'POST', body: payload, token }),
  generatePlan: (payload: GeneratePlanRequest) =>
    request<MealPlanView>('/plan-ahead/generate', { method: 'POST', body: payload, auth: true }),
  getCurrentPlan: () => request<MealPlanView | null>('/plan-ahead/current', { auth: true }),
  // Every plan the user has generated (auto-saved), newest first.
  listPlans: () => request<MealPlanView[]>('/plan-ahead', { auth: true }),
  deletePlan: (planId: string) =>
    request<void>(`/plan-ahead/${planId}`, { method: 'DELETE', auth: true }),
  acceptPlan: (planId: string) =>
    request<MealPlanView>(`/plan-ahead/${planId}/accept`, { method: 'POST', auth: true }),
  // Rebuild every day of the plan (same scope/budget).
  regeneratePlan: (planId: string) =>
    request<MealPlanView>(`/plan-ahead/${planId}/regenerate`, { method: 'POST', auth: true }),
  // `focus` steers this one day ("something with fish") when the meal missed.
  regeneratePlanItem: (planId: string, itemId: string, focus?: string) =>
    request<MealPlanView>(`/plan-ahead/${planId}/items/${itemId}/regenerate`, {
      method: 'POST',
      body: focus ? { focus } : undefined,
      auth: true,
    }),
  // Typeahead for "Replace with something specific" — dish-name picks
  // instead of free-typing a hint and finding out only after submitting
  // whether anything matched. Web counterpart: the same /plan-ahead/meal-ideas
  // route, called directly from PlanView.tsx via the Next.js proxy.
  searchMealIdeas: (query: string) =>
    request<string[]>(`/plan-ahead/meal-ideas?q=${encodeURIComponent(query)}`, { auth: true }),
  removePlanItem: (planId: string, itemId: string) =>
    request<MealPlanView>(`/plan-ahead/${planId}/items/${itemId}`, { method: 'DELETE', auth: true }),
  updatePlanItem: (planId: string, itemId: string, payload: UpdateMealPlanItemRequest) =>
    request<MealPlanView>(`/plan-ahead/${planId}/items/${itemId}`, { method: 'PATCH', body: payload, auth: true }),
  // `regenerate: true` rebuilds an existing list from the plan (keeps manual items).
  generateShoppingList: (planId: string, regenerate = false) =>
    request<ShoppingListView>(`/plan-ahead/${planId}/shopping-list`, {
      method: 'POST',
      body: { regenerate },
      auth: true,
    }),
  getShoppingList: (listId: string) =>
    request<ShoppingListView>(`/plan-ahead/shopping-lists/${listId}`, { auth: true }),
  addShoppingListItem: (listId: string, payload: AddShoppingListItemRequest) =>
    request(`/plan-ahead/shopping-lists/${listId}/items`, { method: 'POST', body: payload, auth: true }),
  updateShoppingListItem: (listId: string, itemId: string, payload: UpdateShoppingListItemRequest) =>
    request(`/plan-ahead/shopping-lists/${listId}/items/${itemId}`, { method: 'PATCH', body: payload, auth: true }),
  removeShoppingListItem: (listId: string, itemId: string) =>
    request<void>(`/plan-ahead/shopping-lists/${listId}/items/${itemId}`, { method: 'DELETE', auth: true }),
  scanPhoto: (payload: ScanPhotoRequest) =>
    request<ScanPhotoResponse>('/scan/photo', { method: 'POST', body: payload, auth: true }),
  // Guest-or-auth, unlike scanPhoto above — see food-content.controller.ts.
  scanFoodContent: (payload: ScanFoodContentRequest, token: string) =>
    request<ScanFoodContentResponse>('/scan/food-content', { method: 'POST', body: payload, token }),
  addPantryItems: (payload: AddPantryItemsRequest) =>
    request<AddPantryItemsResponse>('/pantry/items', { method: 'POST', body: payload, auth: true }),
};

export { ApiError };
