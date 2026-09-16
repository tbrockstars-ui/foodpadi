import Constants from 'expo-constants';
import type {
  AddPantryItemsRequest,
  AddPantryItemsResponse,
  AddShoppingListItemRequest,
  AskCookingQuestionRequest,
  AskCookingQuestionResponse,
  AuthResponse,
  AvoidedIngredientItem,
  CheckCookingStepRequest,
  CheckCookingStepResponse,
  CompanionActionRequest,
  CompanionPreferencesView,
  CompanionSuggestionResponse,
  ConfirmPasswordResetRequest,
  CreateFeedbackRequest,
  CreateStandaloneShoppingListRequest,
  DealerProfileView,
  DealerRatingsResponse,
  DealerSearchRequest,
  DealerSearchResponse,
  DecideRequest,
  DecideResponse,
  FeedbackView,
  FoodGoalsResponse,
  FoodIdeaView,
  FoodPreferenceItem,
  GenerateRecipesRequest,
  GeneratePlanRequest,
  GuestSessionResponse,
  HomeIdeasResponse,
  ImportRecipeRequest,
  LocalFoodSearchInteractionType,
  LocalFoodSearchRequest,
  LocalFoodSearchResponse,
  LoginRequest,
  MealPlanView,
  PantryItemsResponse,
  PlanPreviewResponse,
  RecentlyCookedResponse,
  RecipeView,
  ReferralReceivedStatus,
  ReferralShareChannel,
  ReferralSummary,
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
  SubmitDealerRatingRequest,
  TrackClientEventRequest,
  TrackGoalEventRequest,
  UpdateCompanionPreferencesRequest,
  UpdateFeedbackRequest,
  UpdateMealPlanItemRequest,
  UpdatePlanDefaultsRequest,
  UpdateProfileRequest,
  UpdateShoppingListItemRequest,
  UpsertFoodPreferenceRequest,
  UserSummary,
} from '@foodpadi/shared';
import { tokenStore } from './tokenStore';

// A local Metro/Expo Go dev session always ran against the *deployed*
// production API (app.json's extra.apiBaseUrl is one static URL for every
// build) — any API-side field a local branch hasn't shipped yet then gets
// rejected server-side ("property X should not exist" from class-validator's
// whitelist), even though the exact same field is perfectly valid against the
// API code sitting right next to it. In dev, derive the API host from the
// Metro packager's own LAN address instead (Constants exposes it as
// "hostUri", e.g. "192.168.1.5:8081" — the same host the JS bundle itself
// was just fetched from) and hit the locally running API (apps/api's default
// port, see .env's API_URL) on that machine. Falls back to the configured
// production URL when hostUri isn't a LAN address (tunnel/production builds).
function resolveDevApiBaseUrl(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  if (!host || host.endsWith('.exp.direct') || host.endsWith('.exp.host')) return null;
  return `http://${host}:4310`;
}

const API_BASE_URL: string =
  (__DEV__ && resolveDevApiBaseUrl()) ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  'http://localhost:4310';

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
  const trimmed = rawBody.trim();
  // A CDN / gateway error (Render 502/503, Cloudflare 520-524) returns a full
  // HTML page, not our JSON error shape. Never surface markup as a "message"
  // — the caller falls back to its own friendly line instead.
  if (trimmed.startsWith('<')) return null;
  try {
    const parsed = JSON.parse(trimmed) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join('. ');
    }
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
    return null;
  } catch {
    // A plain-text non-JSON body — keep it only if it's short enough to be a
    // real message, not a dumped document or stack trace.
    return trimmed.length <= 200 ? trimmed : null;
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
    const message =
      extractErrorMessage(rawBody) ??
      (response.status >= 500
        ? 'FoodPadi is having a problem right now. Please try again in a moment.'
        : response.statusText || `Request failed (${response.status})`);
    throw new ApiError(response.status, message);
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
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    // A 2xx that isn't JSON — almost always an HTML page from a proxy /
    // tunnel / captive portal sitting in front of the API. Treat it as a
    // failure with a clean message rather than throwing a raw parse error
    // that a screen might render verbatim.
    throw new ApiError(
      response.status,
      'FoodPadi got an unexpected response from the server. Please try again in a moment.',
    );
  }
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
  // Country of residence, display name, and the birth-month avatar picker
  // (user instruction 2026-09-11) — see packages/shared/src/avatars.ts.
  updateProfile: (patch: UpdateProfileRequest) =>
    request<UserSummary>('/users/me', { method: 'PATCH', body: patch, auth: true }),
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
  // "Feed a Friend" (docs/REFERRAL_PLAN.md). Mobile shares the *web* invite
  // link — inbound attribution on mobile (deep links / install attribution)
  // is a separate piece of work.
  getReferralSummary: () => request<ReferralSummary>('/referrals/me', { auth: true }),
  getReferralLink: () => request<{ link: string }>('/referrals/link', { auth: true }),
  trackReferralShare: (channel: ReferralShareChannel) =>
    request<void>('/referrals/share', { method: 'POST', body: { channel }, auth: true }).catch(() => undefined),
  ackReferralMilestones: () =>
    request<void>('/referrals/milestones/ack', { method: 'POST', auth: true }).catch(() => undefined),
  getReferralReceived: () => request<ReferralReceivedStatus>('/referrals/received', { auth: true }),
  ackReferralWelcome: () =>
    request<void>('/referrals/received/ack', { method: 'POST', auth: true }).catch(() => undefined),
  createGuestSession: () =>
    request<GuestSessionResponse>('/auth/guest-session', { method: 'POST' }),
  acknowledgeGuestDisclaimer: (guestToken: string) =>
    request<GuestSessionResponse>('/auth/guest-session/disclaimer-acknowledge', {
      method: 'POST',
      body: { guestToken },
    }),
  generateCookTodayRecipes: (payload: GenerateRecipesRequest, token: string) =>
    request<RecipeView[]>('/cook-today/generate', { method: 'POST', body: payload, token }),
  // Fire-and-forget client-only analytics for the handful of Cook Today
  // funnel steps with no backend request of their own — same explicit-token
  // pattern as generateCookTodayRecipes above so a guest session works too
  // (auth:true only resolves a signed-in tokenStore token). Web counterpart:
  // apps/web/lib/trackClientEvent.ts.
  trackEvent: (payload: TrackClientEventRequest, token: string) =>
    request<void>('/analytics/track', { method: 'POST', body: payload, token }),
  saveRecipe: (payload: SaveRecipeRequest) =>
    request<SavedRecipeView>('/cook-today/recipes', { method: 'POST', body: payload, auth: true }),
  listSavedRecipes: () => request<SavedRecipeView[]>('/cook-today/recipes', { auth: true }),
  deleteSavedRecipe: (id: string) =>
    request<void>(`/cook-today/recipes/${id}`, { method: 'DELETE', auth: true }),
  // Favorites engine (read side) — recipes with the heart on OR a 5-star COOK
  // rating (see CookTodayService.listFavorites). Web counterpart: the
  // /favorites route + LikeHeart.tsx.
  listFavoriteRecipes: () =>
    request<SavedRecipeView[]>('/cook-today/recipes/favorites', { auth: true }),
  toggleRecipeFavorite: (id: string, isFavorite: boolean) =>
    request<{ isFavorite: boolean }>(`/cook-today/recipes/${id}/favorite`, {
      method: 'PATCH',
      body: { isFavorite },
      auth: true,
    }),
  // "Recently cooked" engine, write side — called once a guided cooking
  // session reaches its last step (web counterpart: apps/web/app/cook-today/
  // CookingSession.tsx). See CookTodayService.markCooked.
  markRecipeCooked: (id: string) =>
    request<{ lastCookedAt: string }>(`/cook-today/recipes/${id}/cooked`, { method: 'POST', auth: true }),
  // Guided-cooking "how did it go?" rating — member-only, matches
  // FeedbackController's JwtAuthGuard (guests get no persistent Memory).
  submitFeedback: (payload: CreateFeedbackRequest) =>
    request<FeedbackView>('/feedback', { method: 'POST', body: payload, auth: true }),
  updateFeedback: (id: string, payload: UpdateFeedbackRequest) =>
    request<FeedbackView>(`/feedback/${id}`, { method: 'PATCH', body: payload, auth: true }),
  importRecipe: (payload: ImportRecipeRequest) =>
    request<RecipeView>('/recipe-import', { method: 'POST', body: payload, auth: true }),
  searchEatNow: (payload: SearchEatNowRequest, token: string) =>
    request<FoodIdeaView[]>('/eat-now/search', { method: 'POST', body: payload, token }),
  // Guest-or-auth, same as searchEatNow/localFoodSearch — the unified
  // "FoodPadi decides" entry point (web counterpart: apps/web/app/DecideFlow.tsx).
  decide: (payload: DecideRequest, token: string) =>
    request<DecideResponse>('/decide', { method: 'POST', body: payload, token }),
  // Cook Today's "Good ideas for you" / "FoodPadi's Pick" / "Quick cook"
  // (web counterpart: apps/web/lib/homeIdeas.ts's loadIdeaCards) — same
  // guest-or-auth GET /home/ideas the web Home page and Cook Today page use.
  // No mood/maxTime/maxBudget query here — mobile Cook Today, like web's own
  // cook-today/page.tsx, just wants the plain unfiltered list.
  getHomeIdeas: (token: string) => request<HomeIdeasResponse>('/home/ideas', { token }),
  // "Recently cooked" strip — same GET /home/recently-cooked, guest-or-auth
  // (always empty for a guest server-side, nothing persists for them).
  getRecentlyCooked: (token: string) =>
    request<RecentlyCookedResponse>('/home/recently-cooked', { token }),
  // "Use These First" — the member's own pantry, oldest-added first (web
  // counterpart: apps/web/lib/homeIdeas.ts's loadPantrySummary). Account-only,
  // same ScanController guard as addPantryItems below.
  listPantryItems: () => request<PantryItemsResponse>('/pantry/items', { auth: true }),
  localFoodSearch: (payload: LocalFoodSearchRequest, token: string) =>
    request<LocalFoodSearchResponse>('/local-food-search', { method: 'POST', body: payload, token }),
  // "Find Near Me" brief §16 — client-only interactions the server can't
  // otherwise observe (a permission prompt's outcome, tapping a maps/order
  // link). Fire-and-forget, same precedent as trackGoalEvent/trackReferralShare:
  // a broken analytics call must never surface to the user or block the flow.
  trackLocalFoodSearchInteraction: (
    interactionType: LocalFoodSearchInteractionType,
    metadata: Record<string, unknown> | undefined,
    token: string,
  ) =>
    request<void>('/local-food-search/interaction', {
      method: 'POST',
      body: { interactionType, metadata },
      token,
    }).catch(() => undefined),
  // FoodPadi Food Dealer Network — the SAME endpoints the web customer app
  // uses (dealer brief §21/§64). Deterministic, guest-accessible, no AI.
  dealerSearch: (params: DealerSearchRequest, token: string) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.locality) qs.set('locality', params.locality);
    if (typeof params.latitude === 'number') qs.set('latitude', String(params.latitude));
    if (typeof params.longitude === 'number') qs.set('longitude', String(params.longitude));
    if (params.category) qs.set('category', params.category);
    if (params.dealerType) qs.set('dealerType', params.dealerType);
    if (params.page) qs.set('page', String(params.page));
    return request<DealerSearchResponse>(`/dealers/search?${qs.toString()}`, { token });
  },
  getDealer: (slug: string) => request<DealerProfileView>(`/dealers/${encodeURIComponent(slug)}`),
  trackDealerEvent: (slug: string, type: string) =>
    request<void>(`/dealers/${encodeURIComponent(slug)}/events`, {
      method: 'POST',
      body: { type },
    }).catch(() => undefined),
  // Post-visit customer ratings (user instruction 2026-09-11). Read is public;
  // write requires a real account — an unauthenticated getMine/submit throws
  // ApiError(401), which the screen treats as "sign in to rate this business".
  getDealerRatings: (slug: string, page = 1) =>
    request<DealerRatingsResponse>(`/dealers/${encodeURIComponent(slug)}/ratings?page=${page}`),
  getMyDealerRating: (slug: string) =>
    request<{ rating: number; comment: string | null } | null>(
      `/dealers/${encodeURIComponent(slug)}/ratings/me`,
      { auth: true },
    ),
  submitDealerRating: (slug: string, payload: SubmitDealerRatingRequest) =>
    request<DealerRatingsResponse>(`/dealers/${encodeURIComponent(slug)}/ratings`, {
      method: 'POST',
      body: payload,
      auth: true,
    }),
  removeMyDealerRating: (slug: string) =>
    request<DealerRatingsResponse>(`/dealers/${encodeURIComponent(slug)}/ratings/me`, {
      method: 'DELETE',
      auth: true,
    }),
  generatePlan: (payload: GeneratePlanRequest) =>
    request<MealPlanView>('/plan-ahead/generate', { method: 'POST', body: payload, auth: true }),
  // Guest-or-auth, AI-free preview of Plan Ahead — a few curated dinner ideas
  // for `days`, nothing persisted (see plan-preview.controller.ts).
  getPlanPreview: (days: number, token: string) =>
    request<PlanPreviewResponse>(`/plan-ahead/preview?days=${days}`, { token }),
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
  // Plan-wide default eating time + reminder lead time ("set once, applies
  // to every day that hasn't been individually overridden"). Web
  // counterpart: same PATCH /plan-ahead/:planId route, called from
  // PlanView.tsx via the Next.js proxy.
  updatePlanDefaults: (planId: string, payload: UpdatePlanDefaultsRequest) =>
    request<MealPlanView>(`/plan-ahead/${planId}`, { method: 'PATCH', body: payload, auth: true }),
  // `regenerate: true` rebuilds an existing list from the plan (keeps manual items).
  generateShoppingList: (planId: string, regenerate = false) =>
    request<ShoppingListView>(`/plan-ahead/${planId}/shopping-list`, {
      method: 'POST',
      body: { regenerate },
      auth: true,
    }),
  // A list built directly from an ingredient set (Cook Today's fridge-check
  // "you need to buy" items), not from an accepted plan — mealPlanId is null
  // on the result. Web counterpart: the same POST /plan-ahead/shopping-lists
  // route, called from FridgeCheck.tsx.
  createStandaloneShoppingList: (payload: CreateStandaloneShoppingListRequest) =>
    request<ShoppingListView>('/plan-ahead/shopping-lists', { method: 'POST', body: payload, auth: true }),
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
  // Account-only, same as scanPhoto above — a guest must never trigger the
  // vision model (see food-content.controller.ts).
  scanFoodContent: (payload: ScanFoodContentRequest) =>
    request<ScanFoodContentResponse>('/scan/food-content', { method: 'POST', body: payload, auth: true }),
  addPantryItems: (payload: AddPantryItemsRequest) =>
    request<AddPantryItemsResponse>('/pantry/items', { method: 'POST', body: payload, auth: true }),
  // FoodPadi Memory & Companion (Home card) — members only, and never called
  // for a guest (HomeScreen gates this). A failed suggestion fetch or action
  // must never break Home, so callers treat rejection as "nothing to show".
  getCompanionSuggestion: () =>
    request<CompanionSuggestionResponse>('/companion/suggestion', { auth: true }),
  sendCompanionAction: (id: string, action: CompanionActionRequest['action']) =>
    request<void>(`/companion/suggestion/${id}/action`, { method: 'POST', body: { action }, auth: true }).catch(
      () => undefined,
    ),
  getCompanionPreferences: () =>
    request<CompanionPreferencesView>('/companion/preferences', { auth: true }),
  updateCompanionPreferences: (payload: UpdateCompanionPreferencesRequest) =>
    request<CompanionPreferencesView>('/companion/preferences', { method: 'PATCH', body: payload, auth: true }),
  resetCompanionMemory: () =>
    request<void>('/companion/memory/reset', { method: 'POST', auth: true }),
  // Guided-cooking assistant — member-only (JwtAuthGuard), same posture as
  // scanPhoto/scanFoodContent: a guest must never trigger a paid AI call.
  checkCookingStep: (payload: CheckCookingStepRequest) =>
    request<CheckCookingStepResponse>('/cooking-assistant/check-step', { method: 'POST', body: payload, auth: true }),
  askCookingQuestion: (payload: AskCookingQuestionRequest) =>
    request<AskCookingQuestionResponse>('/cooking-assistant/ask', { method: 'POST', body: payload, auth: true }),
};

export { ApiError };
