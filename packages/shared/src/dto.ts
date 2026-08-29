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
}

export interface LoginRequest {
  email: string;
  password: string;
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

export interface FoodIdeaView {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  budgetTier: 'low' | 'medium' | 'high';
  tags: string[];
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

export type PlanScope = 'today' | '3day' | 'week' | 'custom';

export interface GeneratePlanRequest {
  scope: PlanScope;
  customDays?: number;
  budgetPence?: number;
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
}

export interface DecideResponse {
  options: DecisionOptionView[];
}

export const DISCLAIMER_TEXT = `AI Food Companion provides food discovery, ingredient information, meal planning, recipes, shopping assistance and general food-related recommendations.

The service is not an allergy monitoring, allergy-management, medical, diagnostic or emergency service.

The app may identify or display food ingredients, grains, allergens or other food components based on information available to it. This information is provided for general informational and planning purposes only and may be incomplete, inaccurate, outdated or changed by a manufacturer, retailer, restaurant or food provider.

AI Food Companion does not determine whether food is safe for you and does not guarantee that any food, drink, ingredient, recipe, restaurant or product is suitable for consumption.

If you have an allergy, intolerance, medical condition or medically required diet, you are responsible for independently checking current product labels, ingredient information and preparation information and, where appropriate, contacting the food provider before consuming the food.

The app does not monitor allergies, allergic reactions, symptoms or medical conditions.

Food businesses may change ingredients, recipes, suppliers or preparation methods. Cross-contact or other preparation-related risks may also exist and may not be identifiable by the app.

Do not rely on this app as your sole source of information when deciding whether food is safe for you or another person.

If you require medical or dietary advice, consult an appropriately qualified healthcare or dietary professional.`;
