import { Injectable } from '@nestjs/common';
import type {
  CompanionCtaTarget,
  CompanionPreferencesView,
  CompanionSuggestionType,
  CompanionSuggestionView,
} from '@foodpadi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CompanionActionValue } from './dto/companion-action.dto';
import { UpdateCompanionPreferencesDto } from './dto/update-companion-preferences.dto';
import { ContextService, type FoodContext, type TodayPlanItem } from './context.service';
import { PatternService } from './pattern.service';

const DEFAULT_PREFERENCES = {
  enabled: true,
  notificationsEnabled: true,
  mutedTypes: [] as string[],
  maxDailySuggestions: 1,
  maxWeeklySuggestions: 3,
};

// Don't send two suggestions close together, even if under the daily cap —
// brief §11 "avoid feedback/notification fatigue".
const MIN_GAP_HOURS = 3;
// "Usual dinner time" only feels right within a window of the actual time,
// not any time that day.
const USUAL_TIME_TOLERANCE_MINUTES = 60;
// Fewer pantry items than this isn't "you have ingredients", it's noise.
const PANTRY_MIN_ITEMS = 3;
// A suggestion type dismissed/marked "not useful" this many times recently
// stops being generated even if the underlying pattern still matches —
// brief §8 "negative feedback is extremely valuable".
const NEGATIVE_FEEDBACK_SUPPRESSION_THRESHOLD = 2;
const NEGATIVE_FEEDBACK_LOOKBACK_DAYS = 30;
// Fixed, deliberately higher than any pattern-derived confidence (capped at
// 0.95 by PatternService.confidenceForEvidence) — a plan the user actually
// committed to always outranks an inferred guess (brief §21: "explicit
// plan settings should ALWAYS take precedence over inferred memory").
const PLAN_SUPPORT_SCORE = 1;
const PANTRY_SCORE = 0.7;

interface RankedCandidate {
  suggestionType: CompanionSuggestionType;
  title: string;
  body: string;
  reason: string;
  ctaLabel: string;
  ctaTarget: CompanionCtaTarget;
  ctaPayload?: CompanionSuggestionView['ctaPayload'];
  score: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Turns FoodContext (current context.service.ts) + FoodPattern rows into the
 * single best CompanionSuggestion for a user, if any. Deterministic template
 * copy only (brief §18/§24/§28) — never an LLM call — and never shown to a
 * guest (JwtAuthGuard-only, see the controller).
 */
@Injectable()
export class CompanionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ContextService,
    private readonly patterns: PatternService,
    private readonly analytics: AnalyticsService,
  ) {}

  async getPreferences(userId: string): Promise<CompanionPreferencesView> {
    const row = await this.upsertPreferenceRow(userId, {});
    return this.toPreferencesView(row);
  }

  async updatePreferences(userId: string, dto: UpdateCompanionPreferencesDto): Promise<CompanionPreferencesView> {
    const row = await this.upsertPreferenceRow(userId, {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.notificationsEnabled !== undefined ? { notificationsEnabled: dto.notificationsEnabled } : {}),
    });
    return this.toPreferencesView(row);
  }

  private toPreferencesView(row: {
    enabled: boolean;
    notificationsEnabled: boolean;
    mutedTypes: string[];
  }): CompanionPreferencesView {
    return {
      enabled: row.enabled,
      notificationsEnabled: row.notificationsEnabled,
      mutedTypes: row.mutedTypes as CompanionSuggestionType[],
    };
  }

  // One row per user, created lazily with defaults on first read/write
  // (schema's own comment) — an upsert is simplest and race-safe.
  private upsertPreferenceRow(userId: string, update: Record<string, unknown>) {
    return this.prisma.companionPreference.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_PREFERENCES, ...update },
      update,
    });
  }

  async getSuggestion(userId: string, now: Date = new Date()): Promise<CompanionSuggestionView | null> {
    const prefs = await this.upsertPreferenceRow(userId, {});
    if (!prefs.enabled) return null;

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 7 * 86_400_000);

    const dayCount = await this.prisma.companionSuggestion.count({ where: { userId, deliveredAt: { gte: dayStart } } });
    if (dayCount >= prefs.maxDailySuggestions) return null;
    const weekCount = await this.prisma.companionSuggestion.count({ where: { userId, deliveredAt: { gte: weekStart } } });
    if (weekCount >= prefs.maxWeeklySuggestions) return null;

    const lastDelivered = await this.prisma.companionSuggestion.findFirst({
      where: { userId },
      orderBy: { deliveredAt: 'desc' },
      select: { deliveredAt: true },
    });
    if (lastDelivered?.deliveredAt && now.getTime() - lastDelivered.deliveredAt.getTime() < MIN_GAP_HOURS * 3_600_000) {
      return null;
    }

    await this.patterns.recompute(userId, now);
    const ctx = await this.context.buildContext(userId, now);
    const suppressed = await this.getSuppressedTypes(userId, now);
    const muted = new Set(prefs.mutedTypes);

    const candidates = [
      this.planSupportCandidate(ctx),
      this.usualTimeCandidate(ctx),
      this.routineCandidate(ctx, suppressed),
      this.pantryCandidate(ctx),
    ].filter((c): c is RankedCandidate => !!c && !muted.has(c.suggestionType));

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    const row = await this.prisma.companionSuggestion.create({
      data: {
        userId,
        suggestionType: best.suggestionType,
        reason: best.reason,
        score: best.score,
        generatedAt: now,
        deliveredAt: now,
      },
    });

    void this.analytics.track('companion_suggestion_shown', { userId }, { suggestionType: best.suggestionType });

    return {
      id: row.id,
      type: best.suggestionType,
      title: best.title,
      body: best.body,
      reason: best.reason,
      ctaLabel: best.ctaLabel,
      ctaTarget: best.ctaTarget,
      ctaPayload: best.ctaPayload,
    };
  }

  async recordAction(userId: string, suggestionId: string, action: CompanionActionValue): Promise<void> {
    const row = await this.prisma.companionSuggestion.findFirst({ where: { id: suggestionId, userId } });
    if (!row) return; // not this user's suggestion — nothing to leak, nothing to correct

    await this.prisma.companionSuggestion.update({
      where: { id: suggestionId },
      data: {
        action,
        actionedAt: new Date(),
        ...(action === 'opened' && !row.openedAt ? { openedAt: new Date() } : {}),
      },
    });

    // "Don't remind me" (brief §13) is a hard mute for that suggestion type
    // going forward, not just a dismissal of this one instance.
    if (action === 'do_not_remind') {
      await this.prisma.companionPreference.upsert({
        where: { userId },
        update: { mutedTypes: { push: row.suggestionType } },
        create: { userId, ...DEFAULT_PREFERENCES, mutedTypes: [row.suggestionType] },
      });
    }

    void this.analytics.track(`companion_suggestion_${action}`, { userId }, { suggestionType: row.suggestionType });
  }

  /** "Reset FoodPadi's learned memory for me" (brief §13/§15). */
  async resetMemory(userId: string): Promise<void> {
    await Promise.all([
      this.patterns.resetForUser(userId),
      this.prisma.companionSuggestion.deleteMany({ where: { userId } }),
    ]);
  }

  private async getSuppressedTypes(userId: string, now: Date): Promise<Set<string>> {
    const since = new Date(now.getTime() - NEGATIVE_FEEDBACK_LOOKBACK_DAYS * 86_400_000);
    const rows = await this.prisma.companionSuggestion.groupBy({
      by: ['suggestionType'],
      where: { userId, action: { in: ['dismissed', 'not_useful'] }, actionedAt: { gte: since } },
      _count: { _all: true },
    });
    return new Set(
      rows.filter((r) => r._count._all >= NEGATIVE_FEEDBACK_SUPPRESSION_THRESHOLD).map((r) => r.suggestionType),
    );
  }

  // A committed plan always outranks an inferred guess (brief §21).
  private planSupportCandidate(ctx: FoodContext): RankedCandidate | null {
    const item: TodayPlanItem | null = ctx.upcomingPlanItem;
    if (!item) return null;
    const isEatOut = item.mealChoice === 'eat_out';
    const mealName = item.recipeTitle;
    return {
      suggestionType: 'plan_support',
      title: isEatOut ? 'Your plan is coming up' : 'Time to start cooking?',
      body: mealName
        ? `${mealName} is planned for ${item.plannedTime} — ${isEatOut ? "your plan's coming up." : 'want to open the recipe?'}`
        : `Your planned meal is coming up at ${item.plannedTime}.`,
      reason: `You planned ${mealName ?? 'a meal'} for ${item.plannedTime} today.`,
      ctaLabel: isEatOut ? 'View plan' : 'Open recipe',
      ctaTarget: isEatOut ? 'plan' : 'cook',
      ctaPayload: !isEatOut && mealName ? { promptFill: mealName } : undefined,
      score: PLAN_SUPPORT_SCORE,
    };
  }

  private usualTimeCandidate(ctx: FoodContext): RankedCandidate | null {
    const relevantKey = `${ctx.weekdayGroup}_dinner`;
    const pattern = ctx.patterns.find((p) => p.patternType === 'meal_time' && p.patternKey === relevantKey);
    if (!pattern) return null;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(pattern.patternValue);
    if (!match) return null;
    const target = new Date(ctx.now);
    target.setHours(Number(match[1]), Number(match[2]), 0, 0);
    const diffMinutes = Math.abs((target.getTime() - ctx.now.getTime()) / 60_000);
    if (diffMinutes > USUAL_TIME_TOLERANCE_MINUTES) return null;
    return {
      suggestionType: 'usual_time',
      title: 'Ready to decide?',
      body: `You usually decide what to eat around ${pattern.patternValue} — want a hand tonight?`,
      reason: `You've usually decided what to eat around ${pattern.patternValue} recently.`,
      ctaLabel: 'Help me decide',
      ctaTarget: 'decide',
      score: pattern.confidence,
    };
  }

  private routineCandidate(ctx: FoodContext, suppressed: Set<string>): RankedCandidate | null {
    if (suppressed.has('routine')) return null;
    const pattern = ctx.patterns.find((p) => p.patternType === 'day_routine' && p.patternKey === ctx.weekdayKey);
    if (!pattern) return null;
    const isEatOut = pattern.patternValue === 'eat_out';
    const dayLabel = `${capitalize(ctx.weekdayKey)}s`;
    return {
      suggestionType: 'routine',
      title: isEatOut ? 'Eating out tonight?' : 'Cooking tonight?',
      body: isEatOut
        ? `You usually eat out on ${dayLabel} — want a suggestion nearby?`
        : `You usually cook on ${dayLabel} — want a quick recipe?`,
      reason: `You've usually ${isEatOut ? 'eaten out' : 'cooked'} on ${dayLabel} recently.`,
      ctaLabel: isEatOut ? 'Find something nearby' : 'Find a recipe',
      ctaTarget: isEatOut ? 'eat_now' : 'cook',
      score: pattern.confidence,
    };
  }

  private pantryCandidate(ctx: FoodContext): RankedCandidate | null {
    if (ctx.pantryItemNames.length < PANTRY_MIN_ITEMS) return null;
    const preview = ctx.pantryItemNames.slice(0, 3).join(', ');
    return {
      suggestionType: 'use_what_you_have',
      title: 'Use what you have?',
      body: `You've got ${preview}${ctx.pantryItemNames.length > 3 ? ' and more' : ''} on hand — want a recipe that uses them?`,
      reason: `You have ${ctx.pantryItemNames.length} pantry items logged.`,
      ctaLabel: 'Find a recipe',
      ctaTarget: 'cook',
      ctaPayload: { initialIngredients: ctx.pantryItemNames },
      score: PANTRY_SCORE,
    };
  }
}
