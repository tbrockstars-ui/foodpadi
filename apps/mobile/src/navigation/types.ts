import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RecipeView } from '@foodpadi/shared';

/**
 * The four primary destinations, now a bottom tab bar (declutter pass) — was
 * previously a run of buttons on Home. Cook keeps the `initialIngredients`
 * param it had as a stack route so Scan's "cook with what's in your pantry"
 * deep-link still works.
 */
export type MainTabParamList = {
  Home: undefined;
  // initialPrompt: "Cook It" on a Decide result (DecideFlow.tsx) deep-links
  // here with the selected meal's exact title, pre-filling the free-text box
  // — same precedent as initialIngredients (Scan's pantry deep-link).
  Cook: { initialIngredients?: string[]; initialPrompt?: string } | undefined;
  Plan: undefined;
  Profile: undefined;
};

/**
 * The root stack. `Main` is the tab navigator; everything else is a leaf
 * screen pushed *over* the tab bar (native-stack hides the parent tab bar on
 * push automatically). Keeping these here — rather than only in AppStack.tsx
 * — lets MainTabs reference the stack param list without an import cycle.
 */
export type AppStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  EatNow: { initialQuery?: string; initialMaxPricePence?: number; whyLabel?: string } | undefined;
  ShoppingList: { listId: string };
  SavedRecipes: undefined;
  Favorites: undefined;
  SavedPlans: undefined;
  Settings: undefined;
  Subscription: undefined;
  Invite: undefined;
  EditGoals: undefined;
  ImportRecipe: undefined;
  Scan: undefined;
  Cuisines: undefined;
  // Birth-month avatar picker (user instruction 2026-09-11).
  EditAvatar: undefined;
  // Guided step-by-step cooking. `savedRecipeId` is passed when the recipe
  // is already persisted (Saved Recipes, or already saved from Cook Today's
  // detail view) so the session can skip its own auto-save.
  CookingSession: { recipe: RecipeView; savedRecipeId?: string };
  // Customer-facing FoodPadi Food Dealer profile (dealer brief §27). A leaf
  // screen pushed over the tab bar from local discovery — not a new tab (§46).
  DealerProfile: { slug: string };
};

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;

/**
 * Props for a tab screen: its own tab route plus the ability to navigate to
 * any root-stack route (`navigation.navigate('SavedRecipes')` etc. still
 * type-checks from inside a tab).
 */
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;
