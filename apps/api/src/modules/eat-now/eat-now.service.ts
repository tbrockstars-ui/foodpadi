import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { RequestActor } from '../auth/guest-or-auth.guard';
import { EAT_NOW_CATALOG, FoodIdea } from './eat-now-catalog';
import { SearchEatNowDto } from './dto/search-eat-now.dto';

const MAX_RESULTS = 5;

// Rough pence ceilings per tier — a soft heuristic (like Plan Ahead's budget
// hint), not a real price. Kept alongside the catalog until we have real
// pricing to sort by.
const BUDGET_TIER_CEILING_PENCE: Record<FoodIdea['budgetTier'], number> = {
  low: 800,
  medium: 1500,
  high: Infinity,
};

function actorToAnalyticsFields(actor: RequestActor) {
  return actor.type === 'user' ? { userId: actor.userId } : { guestSessionId: actor.sessionId };
}

function scoreIdea(idea: FoodIdea, queryTokens: string[]): number {
  const haystack = `${idea.title} ${idea.description} ${idea.cuisine} ${idea.tags.join(' ')}`.toLowerCase();
  return queryTokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

/**
 * Layer 4 ranking over a small, hand-curated MVP dataset (eat-now-catalog.ts)
 * — deterministic keyword matching, no LLM call. This is deliberately a
 * stand-in for a real UK product/restaurant data source (still not chosen —
 * docs/IMPLEMENTATION_PLAN.md Phase 4): good enough to make Eat Now usable
 * for the MVP without fabricating real restaurant/price/availability data.
 * The interface here is what a future Layer 5 (Claude-backed) ranking step
 * would slot behind, once a real data source exists.
 */
@Injectable()
export class EatNowService {
  constructor(private readonly analytics: AnalyticsService) {}

  async search(dto: SearchEatNowDto, actor: RequestActor): Promise<FoodIdea[]> {
    const queryTokens = dto.query.toLowerCase().split(/\s+/).filter(Boolean);
    const cuisineFilter = dto.cuisine?.trim().toLowerCase();

    const results = EAT_NOW_CATALOG.filter((idea) => {
      if (cuisineFilter && !idea.cuisine.toLowerCase().includes(cuisineFilter)) return false;
      if (dto.maxPricePence && BUDGET_TIER_CEILING_PENCE[idea.budgetTier] > dto.maxPricePence) return false;
      return true;
    })
      .map((idea) => ({ idea, score: scoreIdea(idea, queryTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.idea);

    await this.analytics.track('eat_now_searched', actorToAnalyticsFields(actor), {
      resultCount: results.length,
    });

    return results;
  }
}
