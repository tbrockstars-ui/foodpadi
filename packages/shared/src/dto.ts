import type { FoodGoal } from './foodGoals';

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

export interface SetFoodGoalRequest {
  goalType: FoodGoal;
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

export const DISCLAIMER_TEXT = `AI Food Companion provides food discovery, ingredient information, meal planning, recipes, shopping assistance and general food-related recommendations.

The service is not an allergy monitoring, allergy-management, medical, diagnostic or emergency service.

The app may identify or display food ingredients, grains, allergens or other food components based on information available to it. This information is provided for general informational and planning purposes only and may be incomplete, inaccurate, outdated or changed by a manufacturer, retailer, restaurant or food provider.

AI Food Companion does not determine whether food is safe for you and does not guarantee that any food, drink, ingredient, recipe, restaurant or product is suitable for consumption.

If you have an allergy, intolerance, medical condition or medically required diet, you are responsible for independently checking current product labels, ingredient information and preparation information and, where appropriate, contacting the food provider before consuming the food.

The app does not monitor allergies, allergic reactions, symptoms or medical conditions.

Food businesses may change ingredients, recipes, suppliers or preparation methods. Cross-contact or other preparation-related risks may also exist and may not be identifiable by the app.

Do not rely on this app as your sole source of information when deciding whether food is safe for you or another person.

If you require medical or dietary advice, consult an appropriately qualified healthcare or dietary professional.`;
