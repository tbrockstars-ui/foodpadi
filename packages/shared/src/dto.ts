import type { FoodGoal } from './foodGoals';
import type {
  CookingJourneyDestination,
  CookingJourneyStage,
  CookingJourneyStatus,
  CookingTimerStatus,
  IngredientCheckState,
} from './cookingJourney';

// Analytics events reported directly from client interactions on the Food &
// Lifestyle Goals screen (view/select/deselect/etc). `food_goals_completed`
// is excluded — the API tracks that itself when a save actually succeeds.
export const GOAL_CLIENT_EVENT_TYPES = [
  'food_goal_screen_viewed',
  'food_goal_selected',
  'food_goal_deselected',
  'food_goal_limit_reached',
  'food_goal_skipped',
  'no_particular_goal_selected',
  'personal_goal_started',
  'personal_goal_completed',
  'primary_goal_selected',
] as const;

export type GoalClientEventType = (typeof GOAL_CLIENT_EVENT_TYPES)[number];

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
  /**
   * ISO 3166-1 alpha-2 country of residence, asked on the registration form.
   * Sets the FoodPadi Premium currency + local price and the payment provider
   * a checkout routes to. Optional at the API so Google/mobile signups aren't
   * blocked; the web form requires it.
   */
  countryCode?: string;
  /**
   * "Feed a Friend" referral code, when the user arrived via an invite link
   * (docs/REFERRAL_PLAN.md). Best-effort attribution only — an unknown,
   * malformed, or self-referring code is silently ignored and never blocks
   * registration. On web the value rides the `fp_ref` cookie and is attached
   * by the register route handler, not typed by the user.
   */
  referralCode?: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  /** ISO 3166-1 alpha-2 country of residence. */
  countryCode?: string;
  /** 1-12, or null to clear. Only drives which month the avatar picker
      defaults to — not required to set an avatar. */
  birthMonth?: number | null;
  /** "<month>-<shade>" — see packages/shared/src/avatars.ts. */
  avatarId?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Sign up / sign in with a Google account. `idToken` is the JWT credential
// from Google Identity Services (web) or expo-auth-session (mobile); the API
// verifies it with Google and finds-or-creates the matching user. A verified
// Google email that already has a password account logs into that account.
export interface GoogleAuthRequest {
  idToken: string;
  /** "Feed a Friend" code, applied only when this sign-in creates a new account. */
  referralCode?: string;
  /** ISO 3166-1 alpha-2 country of residence, applied only on account creation. */
  countryCode?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

/**
 * A user's access tier, resolved server-side and independent of whether they
 * are authenticated (docs: Guest/Trial/Paid model). 'guest' also covers a
 * registered user whose 7-day trial has ended without subscribing.
 */
export type UserEntitlement = 'guest' | 'trial' | 'paid';

export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  /** ISO 3166-1 alpha-2, or null if never set. */
  countryCode: string | null;
  onboardingCompletedAt: string | null;
  disclaimerAcknowledgedAt: string | null;
  /** Access tier — drives AI availability and the trial/upgrade UI. */
  entitlement: UserEntitlement;
  /** End of the in-app trial, ISO 8601. null once past, never set, or paid. */
  trialEndsAt: string | null;
  /** 1-12, or null if never set. */
  birthMonth: number | null;
  /** Chosen avatar icon id ("<month>-<shade>"), or null — see avatars.ts. */
  avatarId: string | null;
}

export interface SetFoodGoalsRequest {
  /** 1-3 unique goals. If it includes 'none', it must be the only entry. */
  goalTypes: FoodGoal[];
  /** Required when goalTypes has 2+ entries; must be one of them. */
  primaryGoalType?: FoodGoal;
  /** Only persisted when 'personal' is among goalTypes. */
  personalGoalNote?: string;
}

export interface FoodGoalItem {
  goalType: FoodGoal;
  isPrimary: boolean;
  note: string | null;
}

export interface FoodGoalsResponse {
  goals: FoodGoalItem[];
}

export interface TrackGoalEventRequest {
  eventType: GoalClientEventType;
  goalType?: FoodGoal;
}

export interface UpsertFoodPreferenceRequest {
  cuisine?: string;
  likedMeal?: string;
  dislikedIngredient?: string;
  textureDislike?: string;
  cookingStyle?: string;
}

export interface AddAvoidedIngredientRequest {
  ingredientName: string;
  note?: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ConfirmPasswordResetRequest {
  token: string;
  newPassword: string;
}

export interface GenerateRecipesRequest {
  ingredients: string[];
  timeConstraintMinutes?: number;
  servings?: number;
  /** "None of these? Try another set" — recipe titles already shown for this
   * same request, so a second call doesn't just hand back identical options. */
  excludeTitles?: string[];
}

export interface RecipeIngredientView {
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface RecipeView {
  title: string;
  cookTimeMinutes: number;
  servings: number;
  cuisine: string | null;
  ingredients: RecipeIngredientView[];
  steps: string[];
  /** Cook Today only — one entry per step (same length as `steps`), seconds
   * for a step with a genuine cooking duration, null for one that doesn't
   * have a reliable timer. Absent entirely for Plan Ahead / curated / guest
   * recipes — the client falls back to its own best-effort text guess. */
  stepDurationsSeconds?: (number | null)[];
  /** Cook Today only — the prep-only portion of cookTimeMinutes, when the AI
   * could genuinely estimate one (always strictly less than cookTimeMinutes,
   * so `cookTimeMinutes - prepTimeMinutes` is always a positive "active
   * cook" figure). Absent for Plan Ahead / curated / guest recipes, and for
   * any recipe with no distinct prep phase — show only the plain total in
   * that case, same as before this field existed. */
  prepTimeMinutes?: number;
}

// `isFavorite` lets the heart save-and-favourite an idea in one call
// (LikeHeart.tsx) instead of a save-then-toggle round trip.
export type SaveRecipeRequest = RecipeView & { isFavorite?: boolean };

export interface ToggleFavoriteRequest {
  isFavorite: boolean;
}

// ---------------------------------------------------------------------------
// Home "Ideas for you" — GET /home/ideas. Deterministic, no AI (guest-safe):
// the curated recipe pool scored against the member's pantry / preferences /
// goals. `matchPercent` is a real pantry-ingredient overlap, and is null when
// there's no pantry to match against (every guest, and members who haven't
// added anything yet) — the UI hides the "You have X%" line in that case.

export type HomeIdeaDifficulty = 'Easy' | 'Medium' | 'Hard';
export type HomeIdeaPriceBand = '£' | '££' | '£££';

export interface HomeIdeaView {
  /** Stable slug from the recipe title — the key the "save to favourites" heart passes back. */
  slug: string;
  title: string;
  cuisine: string | null;
  timeMinutes: number;
  difficulty: HomeIdeaDifficulty;
  priceBand: HomeIdeaPriceBand;
  /** Real % of this recipe's ingredients the member already has in their pantry; null when there's no pantry to score against. */
  matchPercent: number | null;
  /** The single strongest pantry match — only ever set on one idea, and only when matchPercent is meaningful. */
  bestMatch: boolean;
  /** The full recipe, so the "save" action needs no extra round trip. */
  recipe: RecipeView;
}

export interface HomeIdeasResponse {
  ideas: HomeIdeaView[];
}

// GET /home/recently-cooked — Home's "Recently cooked" card. Real cook
// history: a Recipe the member owns whose `lastCookedAt` was stamped by
// finishing a guided Cook Today session (POST /cook-today/recipes/:id/cooked),
// not just saved/generated. Empty for a guest (nothing persists for them) and
// for a member who hasn't finished cooking anything yet — the client falls
// back to sample cards only if the request itself fails, never to fill a
// genuinely empty history.
export interface RecentlyCookedItem {
  id: string;
  title: string;
  cuisine: string | null;
  /** ISO timestamp of the most recent time this recipe was cooked. */
  lastCookedAt: string;
  /** Favorites engine — see SavedRecipeView.isFavorite. */
  isFavorite: boolean;
}

export interface RecentlyCookedResponse {
  items: RecentlyCookedItem[];
}

// GET /pantry/items — a member's own pantry (built via POST /pantry/items
// from a fridge scan, or added manually), oldest-first. Used by the Cook
// Today "Use These First" section (docs Cook-page-redesign brief §15): the
// oldest-added items are the honest, real-data proxy for "these might need
// using soon" — PantryItem has no expiry/freshness field to draw on, so this
// never claims a stronger signal than it has.
export interface PantryItemView {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  createdAt: string;
}

export interface PantryItemsResponse {
  items: PantryItemView[];
}

// GET /cook-today/recipes — same shape as RecipeView plus the two fields
// that only exist once a recipe is actually persisted (matches the existing
// `RecipeView & { id: string }` pattern used by MealPlanItemView.recipe).
export interface SavedRecipeView extends RecipeView {
  id: string;
  createdAt: string;
  // True when the heart is on. A recipe can also appear in the Favorites
  // engine (GET /cook-today/recipes/favorites) via a 5-star COOK rating
  // without this being true — see CookTodayService.listFavorites.
  isFavorite: boolean;
}

export interface ImportRecipeRequest {
  url: string;
}

export type ScanImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export type DemoScenarioKey = 'fridge' | 'cupboard' | 'mixed' | 'shopping';

export interface ScanPhotoRequest {
  // Either a real photo (imageBase64 + mediaType) or an explicit demo
  // scenario — never both required, the service treats demoScenario as
  // taking priority when present.
  imageBase64?: string;
  mediaType?: ScanImageMediaType;
  demoScenario?: DemoScenarioKey;
}

export interface ScannedItemView {
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface ScanPhotoResponse {
  items: ScannedItemView[];
  // True when this result came from the deterministic demo analyzer (either
  // an explicit "Try a sample kitchen" pick, or SCAN_DEMO_MODE serving a
  // real uploaded photo) rather than real vision analysis — lets the UI
  // show a subtle "Demo mode" indicator without exposing any server config.
  demo: boolean;
}

// "What's in this dish?" — a second, distinct Scan mode alongside the
// pantry one above: given a photo of a prepared dish (not a fridge/cupboard/
// shopping bag), identify the dish and its likely ingredient composition —
// "the possible combination" — so a customer can see roughly what's in
// something before eating it. Account-only, same as the pantry scan above —
// `FoodContentController` is `@UseGuards(JwtAuthGuard)` (a guest must never
// trigger the paid vision model, regardless of whether anything persists).
export interface ScanFoodContentRequest {
  imageBase64: string;
  mediaType: ScanImageMediaType;
}

export interface FoodContentIngredientView {
  name: string;
  // Set when the model is inferring an ingredient it can't actually see
  // (e.g. "oil", "stock", "seasoning") rather than reading it off the plate
  // — surfaced in the UI so an inferred ingredient never reads as a
  // confirmed one. Never used to imply certainty either way about allergens.
  note: string | null;
}

export interface ScanFoodContentResponse {
  /** Best-guess name of the dish, e.g. "Jollof rice with chicken". Empty string if unidentifiable. */
  dishName: string;
  ingredients: FoodContentIngredientView[];
  // Same meaning as ScanPhotoResponse.demo.
  demo: boolean;
}

export interface PantryItemInput {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface AddPantryItemsRequest {
  items: PantryItemInput[];
}

export interface AddPantryItemsResponse {
  added: number;
}

// ---------------------------------------------------------------------------
// Guided-cooking assistant — POST /cooking-assistant/check-step (vision) and
// POST /cooking-assistant/ask (text Q&A), both member-only (JwtAuthGuard,
// same posture as Scan — a guest must never trigger a paid AI call).

export interface CheckCookingStepRequest {
  imageBase64: string;
  mediaType: ScanImageMediaType;
  recipeTitle: string;
  stepText: string;
}

export interface CheckCookingStepResponse {
  /** What's visibly true in the photo relevant to this step. */
  observation: string;
  /** Non-authoritative read on whether it matches this step — never a guarantee. */
  suggestion: string;
  /** Always present — appearance alone can never confirm food safety. */
  safetyNote: string;
}

export interface AskCookingQuestionRequest {
  recipeTitle: string;
  ingredients: string[];
  steps: string[];
  currentStepIndex: number;
  question: string;
}

export interface AskCookingQuestionResponse {
  answer: string;
}

export interface SearchEatNowRequest {
  query: string;
  maxPricePence?: number;
  cuisine?: string;
}

// A recommendation's visual — an externally-sourced, appetising photo that
// stands in for the dish so the customer can SEE what they're choosing, not
// just read it. Always a generic representation of that kind of food, never
// a verified photo of a specific restaurant's actual plate (isRepresentative
// is therefore always true for now) — see the food-image module. `null`
// everywhere it appears means "no suitable image was found" and the UI shows
// a branded placeholder rather than anything misleading.
export interface FoodImageView {
  /** Provider CDN URL, hotlinked per the provider's API terms — never re-hosted. */
  url: string;
  /** Smaller variant for skeleton-swap / low-bandwidth; falls back to `url`. */
  thumbnailUrl: string;
  provider: 'pexels' | 'unsplash';
  photographer: string;
  /** Photographer's profile/page URL for attribution, or null if the provider gave none. */
  photographerUrl: string | null;
  /** The photo's page on the provider (required visible link for Pexels/Unsplash). */
  sourceUrl: string;
  /** Always true for now: a generic representation, not a verified photo of a specific business's dish. */
  isRepresentative: boolean;
}

export interface FoodIdeaView {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  budgetTier: 'low' | 'medium' | 'high';
  tags: string[];
  /** Representative food photo, or null when none was found (UI shows a placeholder). */
  image?: FoodImageView | null;
  // Illustrative estimates only — not real location, live pricing, or a real
  // delivery ETA (no location capability or retailer integration exists yet).
  distanceMiles: number;
  deliveryMinutesMin: number;
  deliveryMinutesMax: number;
  pricePenceMin: number;
  pricePenceMax: number;
}

export interface GuestSessionResponse {
  guestToken: string;
}

export interface FoodPreferenceItem {
  id: string;
  cuisine: string | null;
  likedMeal: string | null;
  dislikedIngredient: string | null;
  textureDislike: string | null;
  cookingStyle: string | null;
}

export interface AvoidedIngredientItem {
  id: string;
  ingredientName: string;
  note: string | null;
}

// 'tomorrow' = a single day starting tomorrow (the "just plan the next day"
// path); 'today' is kept for back-compat but the UI now leads with
// tomorrow/week and tucks the rest behind "more options".
export type PlanScope = 'today' | 'tomorrow' | '3day' | 'week' | 'custom';

export interface GeneratePlanRequest {
  scope: PlanScope;
  customDays?: number;
  budgetPence?: number;
  /** Free-text steer for the whole plan — e.g. "Nigerian food this week", "quick family dinners", "no rice". Optional; falls back to stored cuisine/avoided-ingredient preferences alone when omitted. */
  prompt?: string;
}

// GET /plan-ahead/preview — the guest-accessible, AI-free preview of Plan
// Ahead (a few curated dinner ideas for the chosen number of days, nothing
// persisted). Building a real saved/reminder-backed plan needs an account.
export interface PlanPreviewDay {
  dayIndex: number;
  recipe: RecipeView;
}

export interface PlanPreviewResponse {
  days: PlanPreviewDay[];
}

export interface GenerateShoppingListRequest {
  /**
   * When true and a list already exists for the plan, rebuild it from the
   * plan's current meals — auto-derived items are replaced, manually-added
   * items (addedManually) are kept. When false/omitted the existing list is
   * returned unchanged (the original idempotent behaviour).
   */
  regenerate?: boolean;
}

export type MealChoice = 'cook' | 'eat_out';

export interface MealPlanItemView {
  id: string;
  plannedDate: string;
  mealSlot: string;
  servings: number;
  status: string;
  mealChoice: MealChoice;
  /** "HH:mm" 24h, or null to inherit MealPlanView.defaultMealTime (see
   * planTiming.ts's effectivePlannedTime — never read this field directly to
   * decide what time a day is actually planned for, use that function). */
  plannedTime: string | null;
  /** Per-day override of MealPlanView.defaultReminderOffsetMinutes — null
   * inherits the plan default, an explicit number (including 0, "no
   * reminder") overrides it just for this day. See planTiming.ts's
   * effectiveReminderOffsetMinutes. */
  reminderOffsetMinutes: number | null;
  recipe: (RecipeView & { id: string }) | null;
}

export interface UpdateMealPlanItemRequest {
  mealChoice?: MealChoice;
  plannedTime?: string | null;
  reminderOffsetMinutes?: number | null;
}

/** PATCH /plan-ahead/:planId — the plan-wide default eating time and/or
 * reminder lead time. "Set once, applies to every day that hasn't been
 * individually overridden" — see planTiming.ts. */
export interface UpdatePlanDefaultsRequest {
  defaultMealTime?: string | null;
  defaultReminderOffsetMinutes?: number;
}

export interface MealPlanView {
  id: string;
  scope: PlanScope;
  startDate: string;
  endDate: string;
  budgetPence: number | null;
  status: string;
  createdAt: string;
  /** Id of this plan's shopping list once one has been generated, else null. */
  shoppingListId: string | null;
  /** "HH:mm" 24h plan-wide default eating time, or null if none has been
   * set — see planTiming.ts's effectivePlannedTime. */
  defaultMealTime: string | null;
  /** Minutes before the effective planned time a reminder fires by default
   * (30 unless changed; 0 means no reminder by default) — see planTiming.ts's
   * effectiveReminderOffsetMinutes. */
  defaultReminderOffsetMinutes: number;
  items: MealPlanItemView[];
}

export interface ShoppingListItemView {
  id: string;
  ingredientName: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  addedManually: boolean;
}

export interface ShoppingListView {
  id: string;
  status: string;
  /** The plan this list was built from — lets the list screen offer "rebuild from plan". Null for a standalone list. */
  mealPlanId: string | null;
  /** Present (non-null) only when this list belongs to an active Cooking
   * Journey — i.e. it was created from Cook Today's fridge-check "you need to
   * buy" set. Drives the shopping screen's "← Back to Cooking" header and
   * "Shopping for: {title}" context. Absent/null for plan-derived lists and
   * for plain standalone lists opened outside a cook. */
  cookingJourney?: { id: string; recipeTitle: string; stage: CookingJourneyStage } | null;
  items: ShoppingListItemView[];
}

export interface AddShoppingListItemRequest {
  ingredientName: string;
  quantity?: string;
  unit?: string;
}

/** POST /plan-ahead/shopping-lists — a list built directly from an
 * ingredient set (e.g. Cook Today's fridge-check "you need to buy" items)
 * rather than from an accepted Plan Ahead plan. The result's mealPlanId is
 * null. */
export interface CreateStandaloneShoppingListRequest {
  items: AddShoppingListItemRequest[];
  /** When present, links the new list to this active Cooking Journey and
   * advances that journey to the "shopping" stage, so the cook can leave and
   * come back to exactly this list. Omitted for a plain standalone list. */
  cookingJourneyId?: string;
}

/** POST /analytics/track — the handful of Cook Today funnel steps with no
 * natural backend request of their own to piggyback on. `eventType` is a
 * closed allowlist server-side (see apps/api's track-client-event.dto.ts),
 * not free text — this is not a general client-tracking sink. */
export type ClientEventType =
  | 'cook_today_meal_selected'
  | 'cook_today_start_cooking'
  | 'cook_today_step_completed'
  | 'cook_today_shopping_completed'
  // Fired when the client finds a stale local cook session but the server has
  // no active journey — the fingerprint of the "lost my progress on logout"
  // bug (docs cooking-journey brief §32). Goal: this stays at zero.
  | 'cooking_journey_lost'
  // Daily Companion Reminders lifecycle (brief §30/§48) — only the browser
  // knows when a local Notification actually fired/was clicked/was
  // dismissed, so these ride the same client-event pipe as the above rather
  // than a new one. Setup/enabled/disabled/time-changed are tracked
  // server-side instead (DailyRemindersService), since those already go
  // through a real API call.
  | 'daily_reminder_shown'
  | 'daily_reminder_opened'
  | 'daily_reminder_dismissed';

export interface ClientEventMetadata {
  stepIndex?: number;
  totalSteps?: number;
  itemCount?: number;
  /** Which Daily Companion Reminder slot a daily_reminder_* event is about. */
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'coffee';
}

export interface TrackClientEventRequest {
  eventType: ClientEventType;
  metadata?: ClientEventMetadata;
}

export interface UpdateShoppingListItemRequest {
  checked?: boolean;
  quantity?: string;
  unit?: string;
}

// ---------------------------------------------------------------------------
// Cooking Journey — the persistent, resumable "cook this meal" flow. One
// active journey per user, server-owned, survives navigation / app close /
// logout. The client state machines (CookTodayForm, CookingSession) still
// drive the UI; this is their server mirror. See cookingJourney.ts for the
// pure resolvers.

export interface CookingJourneyShoppingSummary {
  id: string;
  itemsTotal: number;
  itemsChecked: number;
}

export interface CookingJourneyView {
  id: string;
  stage: CookingJourneyStage;
  status: CookingJourneyStatus;
  /** 0-based cooking-step cursor. Only meaningful once stage reaches 'cooking'. */
  currentStep: number;
  /** The recipe being cooked — the live saved Recipe's content, or the frozen
   * snapshot taken when the journey was created if that row was since deleted. */
  recipe: RecipeView;
  /** The saved Recipe.id while it still exists (for rating / mark-cooked).
   * Null once the recipe row is gone and the snapshot is standing in. */
  recipeId: string | null;
  /** The linked shopping list (Cook Today fridge-check "need to buy" set),
   * with just enough to render "N items left". Null until one is created. */
  shoppingList: CookingJourneyShoppingSummary | null;
  /** The full fridge-scan / ingredient-comparison session — scan results, the
   * user's keep/reject decisions, the have/need split, and the "to buy" ticks —
   * so the ingredient check resumes exactly, with no rescan (docs cooking-
   * journey brief §2/§34). Null until a check is started. Legacy `{have,need}`
   * rows are migrated on read. */
  ingredientState: IngredientCheckState | null;
  /** Step-timer state, with `remainingSeconds` already computed server-side at
   * response time. Null when no timer is running for the current step. */
  timer: { status: CookingTimerStatus | null; durationSeconds: number | null; remainingSeconds: number } | null;
  /** Set when the journey originated from a Plan Ahead meal (deep-link target). */
  mealPlanItemId: string | null;
  /** Where "Resume" should land — resolveJourneyDestination applied server-side. */
  destination: CookingJourneyDestination;
  lastActivityAt: string;
  updatedAt: string;
}

/** POST /cooking-journey — start (or, with `replace`, swap) the active journey.
 * Supply exactly one of `recipeId` (a saved recipe / plan meal) or `recipe` (a
 * fresh Cook Today result with no id yet — the API saves it first). */
export interface CreateCookingJourneyRequest {
  recipeId?: string;
  recipe?: RecipeView;
  /** When the journey comes from a Plan Ahead meal. */
  mealPlanItemId?: string;
  /** Required to proceed when an active journey already exists — it is
   * cancelled and this one takes its place (brief §16/§17). Without it the
   * API answers 409 { code: 'ACTIVE_JOURNEY_EXISTS' }. */
  replace?: boolean;
}

/** PATCH /cooking-journey/:id — advance the journey. All fields optional; only
 * the ones sent are written. */
export interface UpdateCookingJourneyRequest {
  stage?: CookingJourneyStage;
  currentStep?: number;
  /** Replace the whole persisted ingredient-check session. FridgeCheck sends
   * this (debounced) on every meaningful action. */
  ingredientState?: IngredientCheckState;
  shoppingListId?: string;
  /** Set alongside `status: 'completed'` once the cook has rated the meal. */
  feedbackId?: string;
  status?: Extract<CookingJourneyStatus, 'completed' | 'cancelled'>;
}

export type CookingJourneyTimerAction = 'start' | 'pause' | 'resume' | 'reset' | 'complete';

/** PATCH /cooking-journey/:id/timer — the server writes the timestamp fields
 * and echoes back the recomputed remaining. */
export interface UpdateCookingJourneyTimerRequest {
  action: CookingJourneyTimerAction;
  /** Required for 'start' and 'reset' — the step's full duration in seconds. */
  durationSeconds?: number;
}

/** 409 body when POST /cooking-journey hits an existing active journey without `replace`. */
export interface ActiveJourneyConflictResponse {
  code: 'ACTIVE_JOURNEY_EXISTS';
  message: string;
  journey: CookingJourneyView;
}

// Local food discovery ("find this food near me") — a supporting capability
// of the decision engine, not a restaurant marketplace. See
// apps/api/src/modules/local-food-search for the real-data-only contract:
// every field here is either grounded (currently: OpenStreetMap tag data) or
// null — never a guessed/constructed value.
export interface LocalFoodSearchRequest {
  query: string;
  /** Preferred path — from the browser/device geolocation API. */
  latitude?: number;
  longitude?: number;
  /** Fallback when location permission is denied/unavailable: a postcode, town, or area. */
  locationText?: string;
}

export type FoodMatchType = 'EXACT_MATCH' | 'CLOSE_MATCH';

export interface FoodProviderResult {
  /** Stable within one response only — not a persisted id. */
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  orderUrl: string | null;
  /** A table/reservation booking URL (e.g. an OpenTable/Resy-style link) — distinct from orderUrl (food ordering). */
  bookingUrl: string | null;
  mapsUrl: string | null;
  /** Approximate and grounded (e.g. "0.4 mi away") — never computed/guessed client- or server-side. */
  distanceText: string | null;
  requestedFood: string;
  matchedFood: string;
  matchType: FoodMatchType;
  /** Raw OpenStreetMap `opening_hours` tag value, shown as-is — never parsed into an "open now" claim (that syntax is its own mini-language) and never present unless the source actually has it. */
  openingHours: string | null;
}

export interface LocalFoodSearchResponse {
  query: string;
  results: FoodProviderResult[];
  /** Non-null only when results came from a real grounded source that requires attribution when shown. */
  source: 'openstreetmap' | null;
}

// ---------------------------------------------------------------------------
// "Find Near Me" client-only interaction analytics — POST /local-food-search/
// interaction. Guest-or-auth, same posture as the search endpoint itself
// (see local-food-search.controller.ts); these are actions the server can't
// otherwise observe (a permission prompt's result, tapping a maps/order link).

export type LocalFoodSearchInteractionType =
  | 'find_near_me_clicked'
  | 'location_permission_granted'
  | 'location_permission_denied'
  | 'manual_location_used'
  | 'place_viewed'
  | 'directions_clicked'
  | 'external_ordering_clicked';

export interface LocalFoodSearchInteractionRequest {
  interactionType: LocalFoodSearchInteractionType;
  metadata?: Record<string, unknown>;
}

// The unified intent-first decision engine — see the "FoodPadi is a food-
// decision engine" architecture memory. Given a free-text description of
// what the user wants/has plus soft constraints, returns a small set of
// explained options blending "cook it" (Cook Today's generation) and "get
// it" (Eat Now's catalog) candidates — never a single-mode result list.
export interface DecideRequest {
  description: string;
  timeMinutes?: number;
  budgetPence?: number;
}

export type DecisionOptionType = 'cook' | 'get';

export interface DecisionOptionView {
  /** Stable within one response only — not a persisted id. */
  id: string;
  type: DecisionOptionType;
  title: string;
  /** Short, human "why this fits" line — e.g. "Ready in 20 min" or "~0.8 mi · £8-10". */
  reason: string;
  /** Present when type === 'cook'. */
  recipe?: RecipeView;
  /** Present when type === 'get' — seeds LocalFoodSearch's query when the user picks "Get it". */
  foodIdea?: FoodIdeaView;
  /**
   * Representative photo of this option's dish, or null when none was found.
   * Resolved server-side (keys stay on the API) and best-effort — a decision
   * is never delayed or dropped because an image lookup failed.
   */
  image?: FoodImageView | null;
}

export interface DecideResponse {
  options: DecisionOptionView[];
}

// --- Referrals ("Feed a Friend", docs/REFERRAL_PLAN.md) ---

export type ReferralStatus = 'pending' | 'qualified' | 'rewarded';

export interface ReferralListItem {
  /** Masked so the dashboard never exposes a referred person's full email. */
  maskedHandle: string;
  status: ReferralStatus;
  createdAt: string;
}

/**
 * The referrer recognition ladder (Phase 1b). Rewards are status/badges, not
 * paid perks — see docs/REFERRAL_PLAN.md §3. The API is the authority on which
 * tier a user is at; this constant lets the client draw the whole ladder.
 */
export interface ReferralTier {
  /** Qualified-referral count that unlocks this tier. */
  threshold: number;
  label: string;
  /** Leading emoji for the badge. */
  icon: string;
}

export const REFERRAL_TIERS: readonly ReferralTier[] = [
  { threshold: 1, label: 'First Invite', icon: '🌱' },
  { threshold: 3, label: 'Food Explorer', icon: '🧭' },
  { threshold: 5, label: 'Super Connector', icon: '⚡' },
  { threshold: 10, label: 'FoodPadi Ambassador', icon: '👑' },
] as const;

export type ReferralMilestoneKind = 'referrer_tier' | 'joined_via_friend';

/** A badge the user has earned but not yet seen a celebration for. */
export interface ReferralMilestoneNotice {
  kind: ReferralMilestoneKind;
  label: string;
  icon: string;
}

export interface ReferralSummary {
  /** The member's personal code, e.g. "K7RPXQ2". */
  code: string;
  /** Ready-to-share absolute URL, e.g. "https://foodpadi.app/?ref=K7RPXQ2". */
  link: string;
  counts: {
    /** Friends who registered through this member's link. */
    joined: number;
    /** ...of whom this many have since done something meaningful in FoodPadi. */
    qualified: number;
  };
  /** Highest tier reached, or null before the first qualified referral. */
  tier: ReferralTier | null;
  /** Next tier to aim for + how many more qualified friends it needs; null once all are earned. */
  nextTier: (ReferralTier & { remaining: number }) | null;
  /** Badges earned but not yet acknowledged — the client shows a celebration, then POSTs the ack. */
  unseen: ReferralMilestoneNotice[];
  /** Most-recent-first, capped server-side. */
  recent: ReferralListItem[];
}

/** Friend-side: whether this account was created via an invite, and whether the welcome is still unseen. */
export interface ReferralReceivedStatus {
  invitedByFriend: boolean;
  unseenWelcome: boolean;
}

/** Where a contextual "share FoodPadi" nudge was shown. */
export type ReferralNudgeContext = 'decision' | 'cook' | 'plan';

/** Channel a share was initiated through — reported from the client. */
export type ReferralShareChannel = 'whatsapp' | 'copy' | 'native' | 'other';

export const DISCLAIMER_TEXT = `AI Food Companion provides food discovery, ingredient information, meal planning, recipes, shopping assistance and general food-related recommendations.

The service is not an allergy monitoring, allergy-management, medical, diagnostic or emergency service.

The app may identify or display food ingredients, grains, allergens or other food components based on information available to it. This information is provided for general informational and planning purposes only and may be incomplete, inaccurate, outdated or changed by a manufacturer, retailer, restaurant or food provider.

AI Food Companion does not determine whether food is safe for you and does not guarantee that any food, drink, ingredient, recipe, restaurant or product is suitable for consumption.

If you have an allergy, intolerance, medical condition or medically required diet, you are responsible for independently checking current product labels, ingredient information and preparation information and, where appropriate, contacting the food provider before consuming the food.

The app does not monitor allergies, allergic reactions, symptoms or medical conditions.

Food businesses may change ingredients, recipes, suppliers or preparation methods. Cross-contact or other preparation-related risks may also exist and may not be identifiable by the app.

Do not rely on this app as your sole source of information when deciding whether food is safe for you or another person.

If you require medical or dietary advice, consult an appropriately qualified healthcare or dietary professional.`;

// ---------------------------------------------------------------------------
// FoodPadi Memory & Companion — GET /companion/suggestion etc. Members only;
// a guest never calls these (JwtAuthGuard-only, no guest token accepted).

export type CompanionSuggestionType =
  | 'usual_time'
  | 'use_what_you_have'
  | 'goal_support'
  | 'variety'
  | 'routine'
  | 'plan_support';

/** Where a suggestion's CTA lands — always an existing screen/flow, never a new one. */
export type CompanionCtaTarget = 'decide' | 'cook' | 'eat_now' | 'plan';

export interface CompanionSuggestionView {
  id: string;
  type: CompanionSuggestionType;
  title: string;
  body: string;
  /** "Why am I seeing this?" — always shown, never hidden (brief §14). */
  reason: string;
  ctaLabel: string;
  ctaTarget: CompanionCtaTarget;
  /** Pre-fills the target flow — e.g. pantry ingredients for Cook, a query for Eat Now. */
  ctaPayload?: {
    initialIngredients?: string[];
    initialQuery?: string;
    whyLabel?: string;
    promptFill?: string;
  };
}

export interface CompanionSuggestionResponse {
  suggestion: CompanionSuggestionView | null;
}

export type CompanionAction = 'opened' | 'accepted' | 'dismissed' | 'not_useful' | 'do_not_remind';

export interface CompanionActionRequest {
  action: CompanionAction;
}

export interface CompanionPreferencesView {
  enabled: boolean;
  notificationsEnabled: boolean;
  mutedTypes: CompanionSuggestionType[];
}

export interface UpdateCompanionPreferencesRequest {
  enabled?: boolean;
  notificationsEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Feedback & Rating — POST/GET/PATCH/DELETE /feedback. Signed-in only, same
// posture as Companion above. Feeds PatternService's recipe/cuisine/
// plan-satisfaction detectors server-side (apps/api/src/modules/companion/
// pattern.service.ts) — never read back into a user-facing "your rating
// history" feature yet (Phase 3).

export type FeedbackEntityType = 'RECIPE' | 'MEAL' | 'PLAN';
export type FeedbackContext = 'EAT_NOW' | 'COOK' | 'PLAN' | 'DECIDE' | 'ORDER' | 'OTHER';

export interface CreateFeedbackRequest {
  entityType: FeedbackEntityType;
  entityId: string;
  context: FeedbackContext;
  /** 1-5 */
  rating: number;
  /** Quick-tag keys, e.g. "loved_it" / "would_make_again" — see FEEDBACK_TAGS. */
  tags?: string[];
  comment?: string;
}

export interface UpdateFeedbackRequest {
  rating?: number;
  tags?: string[];
  comment?: string;
}

export interface FeedbackView {
  id: string;
  entityType: FeedbackEntityType;
  entityId: string;
  context: FeedbackContext;
  rating: number;
  tags: string[];
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Quick-tag vocabulary per context (brief §A/§B/§C) — kept as data rather
 * than duplicated per screen, mobile and web both render from this.
 */
export const FEEDBACK_TAGS: Record<FeedbackEntityType, { positive: string[]; negative: string[] }> = {
  MEAL: {
    positive: ['loved_it', 'really_good', 'would_choose_again'],
    negative: ['it_was_okay', 'not_for_me', 'wouldnt_choose_again'],
  },
  RECIPE: {
    positive: ['loved_it', 'tasty', 'would_make_again'],
    negative: ['too_difficult', 'too_long', 'wouldnt_make_again'],
  },
  PLAN: {
    positive: ['meals_suited_me', 'good_variety', 'easy_to_cook', 'stayed_within_budget', 'used_ingredients_i_had'],
    negative: ['too_repetitive', 'too_expensive', 'too_much_cooking', 'not_enough_variety', 'didnt_suit_schedule'],
  },
};

/**
 * Cooking-experience tags — separate from RECIPE's like/dislike tags above.
 * Shown on the post-cook feedback screen (CookingSession.tsx /
 * CookingSessionScreen.tsx) once a rating is picked, to capture what would
 * help FoodPadi write clearer instructions for *other* cooks. These feed
 * CookingInsightsService's anonymous per-dish aggregate
 * (apps/api/src/modules/feedback/cooking-insights.service.ts) — a
 * cross-customer learning signal for AI recipe generation — never a single
 * customer's own Memory (that's what RECIPE's tags above are for).
 */
export const COOKING_EXPERIENCE_TAGS = {
  positive: ['steps_clear', 'timings_accurate'],
  negative: ['steps_unclear', 'timings_off', 'quantities_off'],
};

export const FEEDBACK_TAG_LABELS: Record<string, string> = {
  loved_it: 'Loved it',
  really_good: 'Really good',
  would_choose_again: 'Would choose again',
  it_was_okay: 'It was okay',
  not_for_me: 'Not for me',
  wouldnt_choose_again: "Wouldn't choose it again",
  tasty: 'Tasty',
  would_make_again: 'Would make again',
  too_difficult: 'Too difficult',
  too_long: 'Too long',
  wouldnt_make_again: "Wouldn't make again",
  meals_suited_me: 'Meals suited me',
  good_variety: 'Good variety',
  easy_to_cook: 'Easy to cook',
  stayed_within_budget: 'Stayed within budget',
  used_ingredients_i_had: 'Used ingredients I already had',
  too_repetitive: 'Too repetitive',
  too_expensive: 'Too expensive',
  too_much_cooking: 'Too much cooking',
  not_enough_variety: 'Not enough variety',
  didnt_suit_schedule: "Didn't suit my schedule",
  steps_clear: 'Steps were clear',
  timings_accurate: 'Timings were accurate',
  steps_unclear: 'Steps were unclear',
  timings_off: "Timings didn't match",
  quantities_off: 'Quantities were vague',
};

// ---------------------------------------------------------------------------
// FoodPadi Premium subscription (docs/SUBSCRIPTION_MODEL.md).
//
// $4.99 USD/month is the canonical commercial price. A `local` amount, when
// present, is a provider-sourced presentment price for the resolved country —
// read from the Stripe Price's currency_options, or from the Flutterwave
// payment plan for Nigeria. It is never computed from an exchange rate, and
// the provider's own checkout amount is always authoritative for the charge.
export const PREMIUM_BASE_PRICE_CENTS = 499;
export const PREMIUM_BASE_CURRENCY = 'usd';
export const PREMIUM_BILLING_INTERVAL = 'month';

// Which processor runs a given customer's billing. Chosen by country: Nigeria
// routes to Flutterwave (native NGN) when it is configured, everyone else to
// Stripe. A user is on exactly one provider at a time.
export type PaymentProvider = 'stripe' | 'flutterwave';

// Country-of-residence options for the registration form + the paywall's
// country picker. Not exhaustive — a country not listed here just gets USD
// pricing. Sorted by name; keep the target markets (UK, EU, Nigeria) and the
// Stripe-supported non-European countries covered.
export interface CountryOption {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}
export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'CA', name: 'Canada' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NO', name: 'Norway' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TH', name: 'Thailand' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
] as const;

const COUNTRY_CODE_SET = new Set(COUNTRY_OPTIONS.map((c) => c.code));

/** True for a value we offer in the picker (a 2-letter code we know). */
export function isKnownCountryCode(code: string | null | undefined): boolean {
  return !!code && COUNTRY_CODE_SET.has(code.toUpperCase());
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_OPTIONS.find((c) => c.code === code.toUpperCase())?.name ?? code.toUpperCase();
}

// The Premium value props shown on the upgrade prompt / paywall (task STEP 1).
export const PREMIUM_FEATURES: readonly string[] = [
  'Personalized meal planning',
  'AI-powered food assistance',
  'Advanced planning tools',
  'Premium cooking features',
  'More personalized recommendations',
];

// Mirrors Stripe's subscription.status verbatim, plus 'none' for a user who has
// never started checkout.
export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export interface MoneyView {
  /** Minor units (cents/pence). For zero-decimal currencies this is the whole amount. */
  amountCents: number;
  /** ISO 4217, lowercase — matches Stripe's representation. */
  currency: string;
}

export interface PricingView {
  base: MoneyView; // always { amountCents: 499, currency: 'usd' }
  /** Estimated local equivalent (base price at the daily FX rate), or null (→ show USD only). */
  local: MoneyView | null;
  /** ISO country the estimate was resolved for (a hint from Accept-Language, not authoritative). */
  localCountry: string | null;
  /** Which provider a checkout from here will use. */
  provider: PaymentProvider;
  /** The `local` line is ALWAYS an estimate before checkout. */
  estimate: true;
  /** ISO timestamp of the FX snapshot the `local` estimate used (Stripe path). */
  ratesUpdatedAt?: string | null;
}

/** One row of the admin dashboard's FX-rates table. */
export interface FxRateRow {
  currency: string; // ISO 4217, lowercase
  /** Units of `currency` per 1 USD, or null when the feed has no rate for it. */
  rate: number | null;
  /** The current base price converted at `rate` (minor units), for display. */
  estimated: MoneyView | null;
}

export interface FxRatesView {
  baseCurrency: string; // 'usd'
  source: string | null;
  fetchedAt: string | null; // ISO
  /** Whole hours since the snapshot was fetched, or null if never. */
  ageHours: number | null;
  rows: FxRateRow[];
}

export interface SubscriptionView {
  /** The single entitlement answer every gated surface should read. */
  premium: boolean;
  plan: 'free' | 'premium';
  status: SubscriptionStatus;
  /** Which processor owns this subscription. 'stripe' for a free user (default). */
  provider: PaymentProvider;
  base: MoneyView;
  /** What the provider actually charges this customer, once a payment exists. */
  presentment: MoneyView | null;
  billingInterval: string;
  currentPeriodEnd: string | null; // ISO 8601
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null; // ISO 8601
  trialEndsAt: string | null; // ISO 8601
  customerCountry: string | null;
  /** True when the Stripe billing portal can be opened (Stripe subs only). */
  canManage: boolean;
  /** True when this subscription can be cancelled in-app (Flutterwave subs). */
  canCancel: boolean;
}

export interface CreateCheckoutRequest {
  /** Defaults to 'stripe'. 'flutterwave' is accepted only for Nigeria. */
  provider?: PaymentProvider;
}

export interface CreateCheckoutResponse {
  url: string;
  provider: PaymentProvider;
}

export interface CreatePortalResponse {
  url: string;
}

export interface CheckoutSyncRequest {
  provider?: PaymentProvider;
  /** Stripe: the Checkout Session id (`cs_...`). */
  sessionId?: string;
  /** Flutterwave: the reference we generated + Flutterwave's transaction id, from the redirect. */
  txRef?: string;
  transactionId?: string;
}

export interface CheckoutSyncResponse {
  subscription: SubscriptionView;
  /** True when this sync is what flipped the user to premium (for the success screen). */
  justActivated: boolean;
}

// ---------------------------------------------------------------------------
// Admin: dynamic parameterised subscription value management
// (apps/web/app/admin/billing → apps/api AdminBillingController → BillingConfig).

/**
 * Default Stripe presentment amounts per currency (minor units). Seeds a fresh
 * `BillingConfig` row and `stripe:setup`; the admin UI edits the live values.
 * A country whose currency is absent here just shows USD until an amount is set.
 * Rough ~$5 equivalents — tune in the admin dashboard, they are not exchange rates.
 */
export const DEFAULT_CURRENCY_OPTIONS: Record<string, number> = {
  // Europe / established
  gbp: 449,
  eur: 499,
  chf: 499,
  sek: 5900,
  nok: 5900,
  dkk: 3900,
  pln: 2199,
  // Outside Europe — other Stripe-supported presentment currencies
  usd: 499,
  cad: 699,
  aud: 799,
  nzd: 899,
  sgd: 699,
  hkd: 3900,
  jpy: 750, // zero-decimal: whole yen
  aed: 1899,
  myr: 2299,
  brl: 2790,
  mxn: 9900,
  zar: 9900,
};

export interface BillingConfigView {
  basePriceCents: number;
  baseCurrency: string;
  billingInterval: 'month';
  /** Stripe-side trial length (card-gated). Unrelated to the in-app trial below. */
  trialDays: number;
  /** In-app, no-card trial length in days — the Guest/Trial/Paid model's trial. */
  appTrialDays: number;
  /** Total AI requests a trial user may make before the cap (server-enforced). */
  trialAiLimit: number;
  /** Days a past_due subscription keeps Premium after its paid period (dunning window). */
  pastDueGraceDays: number;
  /** Flutterwave (Nigeria) price — whole Naira per month. */
  flwNgnAmount: number;
  /** Per-currency Stripe presentment amounts, minor units. */
  currencyOptions: Record<string, number>;
  /** Live provider ids in effect (config override else env). */
  stripePriceId: string | null;
  flwPlanId: string | null;
  /** FoodPadi Food Dealer Network subscription price (a separate product from
      Premium), USD minor units — e.g. 499 = $4.99 / month. */
  dealerPriceCents: number;
  /** Dealer subscription Nigeria price, whole Naira per month (Flutterwave). */
  dealerNgnAmount: number;
  dealerStripePriceId: string | null;
  dealerFlwPlanId: string | null;
  updatedAt: string | null;
  stripeConfigured: boolean;
  stripeDemo: boolean;
  flutterwaveConfigured: boolean;
  flutterwaveDemo: boolean;
}

export interface UpdateBillingConfigRequest {
  basePriceCents?: number;
  baseCurrency?: string;
  trialDays?: number;
  appTrialDays?: number;
  trialAiLimit?: number;
  pastDueGraceDays?: number;
  flwNgnAmount?: number;
  currencyOptions?: Record<string, number>;
  /** Food Dealer subscription price, USD minor units (e.g. 499 = $4.99). */
  dealerPriceCents?: number;
  dealerNgnAmount?: number;
}

export interface UpdateBillingConfigResponse {
  config: BillingConfigView;
  /** Non-fatal issues, e.g. "the DB was updated but Stripe could not be reached". */
  warnings: string[];
}
