export interface AdminAnalyticsOverview {
  users: {
    total: number;
    active: number;
    suspended: number;
    newLast7Days: number;
    newLast30Days: number;
  };
  waitlist: {
    total: number;
    newLast7Days: number;
  };
  foodIdeas: {
    total: number;
    active: number;
    inactive: number;
  };
  content: {
    recipes: number;
    mealPlans: number;
    pantryItems: number;
  };
  trend: {
    days: string[];
    users: number[];
    waitlist: number[];
  };
}
