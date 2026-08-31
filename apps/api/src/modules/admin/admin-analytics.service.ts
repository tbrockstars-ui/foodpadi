import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const TREND_DAYS = 14;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Buckets a set of timestamps into per-day counts across `days` (oldest
 * first), for the sparkline on the admin overview dashboard. */
function bucketByDay(rows: { createdAt: Date }[], days: string[]): number[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const row of rows) {
    const key = isoDate(row.createdAt);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return days.map((d) => counts.get(d) ?? 0);
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A single rollup for the admin dashboard's overview cards + trend chart.
   * Deliberately built from cheap count()/findMany-with-select queries
   * rather than a raw SQL groupBy — dev/early-production volumes here are
   * small enough that this stays fast, and it keeps the query portable.
   */
  async overview() {
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const trendStart = startOfDay(new Date(now.getTime() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000));

    const [
      totalUsers,
      suspendedUsers,
      newUsers7,
      newUsers30,
      totalWaitlist,
      newWaitlist7,
      totalFoodIdeas,
      activeFoodIdeas,
      totalRecipes,
      totalMealPlans,
      totalPantryItems,
      recentUsers,
      recentWaitlist,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { deletedAt: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: last30 } } }),
      this.prisma.waitlistSignup.count(),
      this.prisma.waitlistSignup.count({ where: { createdAt: { gte: last7 } } }),
      this.prisma.foodIdea.count(),
      this.prisma.foodIdea.count({ where: { isActive: true } }),
      this.prisma.recipe.count({ where: { deletedAt: null } }),
      this.prisma.mealPlan.count({ where: { deletedAt: null } }),
      this.prisma.pantryItem.count({ where: { deletedAt: null } }),
      this.prisma.user.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
      this.prisma.waitlistSignup.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
    ]);

    const days: string[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      days.push(isoDate(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
    }

    return {
      users: {
        total: totalUsers,
        active: totalUsers - suspendedUsers,
        suspended: suspendedUsers,
        newLast7Days: newUsers7,
        newLast30Days: newUsers30,
      },
      waitlist: {
        total: totalWaitlist,
        newLast7Days: newWaitlist7,
      },
      foodIdeas: {
        total: totalFoodIdeas,
        active: activeFoodIdeas,
        inactive: totalFoodIdeas - activeFoodIdeas,
      },
      content: {
        recipes: totalRecipes,
        mealPlans: totalMealPlans,
        pantryItems: totalPantryItems,
      },
      trend: {
        days,
        users: bucketByDay(recentUsers, days),
        waitlist: bucketByDay(recentWaitlist, days),
      },
    };
  }
}
