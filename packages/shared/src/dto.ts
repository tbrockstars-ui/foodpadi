import type { FoodGoal } from './foodGoals';

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
   * "Feed a Friend" referral code, when the user arrived via an invite link
   * (docs/REFERRAL_PLAN.md). Best-effort attribution only — an unknown,
   * malformed, or self-referring code is silently ignored and never blocks
   * registration. On web the value rides the `fp_ref` cookie and is attached
   * by the register route handler, not typed by the user.
   */
  referralCode?: string;
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
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  onboardingCompletedAt: string | null;
  disclaimerAcknowledgedAt: string | null;
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
}

export type SaveRecipeRequest = RecipeView;

// GET /cook-today/recipes — same shape as RecipeView plus the two fields
// that only exist once a recipe is actually persisted (matches the existing
// `RecipeView & { id: string }` pattern used by MealPlanItemView.recipe).
export interface SavedRecipeView extends RecipeView {
  id: string;
  createdAt: string;
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
// something before eating it. Guest-accessible (same precedent as Decide/
// Eat Now/Cook Today) since nothing is persisted here, unlike the pantry
// scan above which is account-only.
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
  /** "HH:mm" 24h, or null if no time has been set for this item yet. */
  plannedTime: string | null;
  recipe: (RecipeView & { id: string }) | null;
}

export interface UpdateMealPlanItemRequest {
  mealChoice?: MealChoice;
  plannedTime?: string | null;
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
  items: ShoppingListItemView[];
}

export interface AddShoppingListItemRequest {
  ingredientName: string;
  quantity?: string;
  unit?: string;
}

export interface UpdateShoppingListItemRequest {
  checked?: boolean;
  quantity?: string;
  unit?: string;
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
}

export interface LocalFoodSearchResponse {
  query: string;
  results: FoodProviderResult[];
  /** Non-null only when results came from a real grounded source that requires attribution when shown. */
  source: 'openstreetmap' | null;
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
