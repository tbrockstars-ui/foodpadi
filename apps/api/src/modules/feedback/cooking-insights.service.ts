import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const LOOKBACK_DAYS = 180;
const MIN_COOKS_FOR_SIGNAL = 3;
const MIN_ISSUE_COOKS = 2;
const MIN_ISSUE_SHARE = 0.25;
const MAX_NOTES = 3;
const MAX_NOTE_CHARS = 140;
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface DishInsight {
  cookCount: number;
  avgRating: number;
  wouldMakeAgainRate: number; // 0-1, share of feedback rows rated >= 4
  topIssues: string[]; // plain-English phrases, ready to drop into a prompt
  notableNotes: string[]; // short, de-identified free-text snippets
}

const ISSUE_PHRASES: Record<string, string> = {
  too_difficult: 'instructions were hard to follow',
  too_long: 'it took longer than the stated time',
  timings_off: "step timings didn't match reality",
  quantities_off: 'ingredient quantities were unclear',
  steps_unclear: 'the steps were confusing to follow',
};

// Keywords that let a free-text comment "corroborate" one of the tag-derived
// issues above, so a note only ever reaches the model when it backs up a
// pattern several cooks already reported — never a single person's one-off view.
const ISSUE_KEYWORDS: Record<string, string[]> = {
  too_difficult: ['hard', 'difficult', 'confus', 'complicat'],
  too_long: ['long', 'slow', 'took ages', 'forever'],
  timings_off: ['time', 'timer', 'minute', 'longer than'],
  quantities_off: ['quantity', 'quantities', 'amount', 'how much', 'measurement'],
  steps_unclear: ['unclear', 'confus', "didn't understand", 'vague'],
};

function normaliseDishKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Best-effort scrub of anything that looks like it could identify the
// reporter (email, @handle) before a comment is ever used as model input.
function deidentify(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted]')
    .replace(/@[\w-]+/g, '[redacted]')
    .trim();
}

/**
 * Anonymous, aggregate "what other cooks reported" signal — the cross-customer
 * counterpart to PatternService (which is per-user Memory). Reads FoodFeedback
 * rows with context='COOK', groups them by normalised dish title (Recipe rows
 * are one-per-user/per-cook, so the same dish has many Recipe ids — see
 * apps/api/prisma/schema.prisma's Recipe.title comment), and turns them into a
 * short string ClaudeService can drop into a generation prompt.
 *
 * Suppressed entirely below MIN_COOKS_FOR_SIGNAL — both because a single
 * report is noise, not signal, and because surfacing it could effectively
 * identify one person's feedback.
 */
@Injectable()
export class CookingInsightsService {
  private readonly logger = new Logger(CookingInsightsService.name);
  private cache = new Map<string, { at: number; insight: DishInsight | null }>();

  constructor(private readonly prisma: PrismaService) {}

  async getInsightForDish(title: string): Promise<DishInsight | null> {
    const key = normaliseDishKey(title);
    if (!key) return null;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.insight;

    const insight = await this.computeInsight(key).catch((err) => {
      this.logger.warn(`Cooking insight lookup failed for "${title}": ${String(err)}`);
      return null;
    });
    this.cache.set(key, { at: Date.now(), insight });
    return insight;
  }

  /**
   * A ready-to-use prompt line, or null when there's nothing worth saying.
   * Deliberately style guidance only — callers must not let this touch
   * ingredients, allergens or avoided-ingredient rules.
   */
  async getPromptNote(title: string): Promise<string | null> {
    const insight = await this.getInsightForDish(title);
    if (!insight) return null;
    return this.issuesToNote(insight.topIssues, insight.notableNotes, 'made a similar dish before');
  }

  /**
   * Dish-agnostic version of getPromptNote — for generation calls that don't
   * name a specific dish yet (Cook Today builds recipes from ingredients, not
   * a title). Aggregates the most common issues across ALL recent cooks
   * rather than one dish, so it's usable on every call. Cached like the
   * per-dish lookup.
   */
  async getGeneralGuidance(): Promise<string | null> {
    const cached = this.cache.get('__general__');
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.insight ? this.issuesToNote(cached.insight.topIssues, cached.insight.notableNotes) : null;
    }
    const insight = await this.computeGeneralInsight().catch((err) => {
      this.logger.warn(`General cooking insight lookup failed: ${String(err)}`);
      return null;
    });
    this.cache.set('__general__', { at: Date.now(), insight });
    return insight ? this.issuesToNote(insight.topIssues, insight.notableNotes) : null;
  }

  private issuesToNote(
    topIssues: string[],
    notableNotes: string[],
    context: string = 'have cooked with FoodPadi recently',
  ): string | null {
    if (topIssues.length === 0) return null;
    const notes = notableNotes.length ? ` Cook comments: ${notableNotes.join(' / ')}.` : '';
    const note =
      `Cooks who ${context} reported: ${topIssues.join('; ')}. Write step timings that match how long ` +
      `things really take, be specific with quantities and pan sizes, and keep instructions in plain, ` +
      `followable steps.${notes}`;
    return note.length > 400 ? `${note.slice(0, 397)}...` : note;
  }

  private async computeGeneralInsight(): Promise<DishInsight | null> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
    const rows = await this.prisma.foodFeedback.findMany({
      where: { context: 'COOK', entityType: 'RECIPE', deletedAt: null, createdAt: { gte: since } },
      select: { rating: true, tags: true, comment: true },
    });
    if (rows.length < MIN_COOKS_FOR_SIGNAL) return null;
    return this.summarise(rows);
  }

  private async computeInsight(key: string): Promise<DishInsight | null> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
    const feedback = await this.prisma.foodFeedback.findMany({
      where: { context: 'COOK', entityType: 'RECIPE', deletedAt: null, createdAt: { gte: since } },
      select: { entityId: true, rating: true, tags: true, comment: true },
    });
    if (feedback.length === 0) return null;

    const recipeIds = [...new Set(feedback.map((f) => f.entityId))];
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: { id: true, title: true },
    });
    const titleByRecipeId = new Map(recipes.map((r) => [r.id, r.title]));

    const rows = feedback.filter((f) => normaliseDishKey(titleByRecipeId.get(f.entityId) ?? '') === key);
    if (rows.length < MIN_COOKS_FOR_SIGNAL) return null;
    return this.summarise(rows);
  }

  /** Shared tag/comment → DishInsight rollup, used for both a single dish's
   * rows and the dish-agnostic "all recent cooks" rows. */
  private summarise(rows: { rating: number; tags: string[]; comment: string | null }[]): DishInsight {
    const avgRating = rows.reduce((sum, r) => sum + r.rating, 0) / rows.length;
    const wouldMakeAgainRate = rows.filter((r) => r.rating >= 4).length / rows.length;

    const tagCounts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const topIssues: string[] = [];
    for (const [tag, phrase] of Object.entries(ISSUE_PHRASES)) {
      const count = tagCounts.get(tag) ?? 0;
      if (count >= MIN_ISSUE_COOKS && count / rows.length >= MIN_ISSUE_SHARE) {
        topIssues.push(phrase);
      }
    }

    const activeIssueKeywords = topIssues.length
      ? Object.entries(ISSUE_KEYWORDS)
          .filter(([tag]) => ISSUE_PHRASES[tag] && topIssues.includes(ISSUE_PHRASES[tag]))
          .flatMap(([, keywords]) => keywords)
      : [];
    const notableNotes: string[] = [];
    for (const row of rows) {
      if (notableNotes.length >= MAX_NOTES) break;
      if (!row.comment?.trim()) continue;
      const lower = row.comment.toLowerCase();
      const corroborates = activeIssueKeywords.some((kw) => lower.includes(kw));
      const lowRated = row.rating <= 2;
      if (!corroborates && !lowRated) continue;
      const clean = deidentify(row.comment.trim());
      notableNotes.push(clean.length > MAX_NOTE_CHARS ? `${clean.slice(0, MAX_NOTE_CHARS - 3)}...` : clean);
    }

    return {
      cookCount: rows.length,
      avgRating: Math.round(avgRating * 10) / 10,
      wouldMakeAgainRate: Math.round(wouldMakeAgainRate * 100) / 100,
      topIssues,
      notableNotes,
    };
  }
}
