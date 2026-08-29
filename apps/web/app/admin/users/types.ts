// Mirrors apps/api/src/modules/admin/admin-users.service.ts's response shapes.
// Admin-only, web-only — not shared with mobile (@foodpadi/shared), so these
// live here rather than in the shared package.

export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  onboardingCompletedAt: string | null;
  disclaimerAcknowledgedAt: string | null;
  suspended: boolean;
  suspendedAt: string | null;
}

export interface AdminUserListResponse {
  users: AdminUserSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminUserDetail extends AdminUserSummary {
  authProvider: string;
  goals: { id: string; goalType: string; isPrimary: boolean; note: string | null }[];
  preferences: { id: string; cuisine: string | null; likedMeal: string | null; dislikedIngredient: string | null }[];
  avoidedIngredients: { id: string; ingredientName: string }[];
  counts: {
    recipes: number;
    mealPlans: number;
    pantryItems: number;
    shoppingLists: number;
  };
}
