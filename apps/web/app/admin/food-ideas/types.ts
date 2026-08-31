// Mirrors apps/api/src/modules/admin/admin-food-ideas.service.ts's response shape.

export type BudgetTier = 'low' | 'medium' | 'high';

export interface AdminFoodIdea {
  id: string;
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  budgetTier: BudgetTier;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFoodIdeaListResponse {
  items: AdminFoodIdea[];
  page: number;
  pageSize: number;
  total: number;
}

export interface FoodIdeaFormValues {
  slug?: string;
  title: string;
  description: string;
  cuisine: string;
  budgetTier: BudgetTier;
  tags: string[];
}
