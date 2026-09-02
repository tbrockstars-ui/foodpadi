import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { CURATED_RECIPES, curatedPlanForDays, scoreCuratedByHint } from './curated-recipes';

export interface RawRecipeCandidate {
  title: unknown;
  cookTimeMinutes: unknown;
  servings: unknown;
  cuisine?: unknown;
  ingredients: unknown;
  steps: unknown;
}

export interface CookTodayGenerationInput {
  ingredients: string[];
  timeConstraintMinutes?: number;
  servings?: number;
  /** The signed-in user's favourite cuisines (Preferences) — lean toward, don't restrict. */
  favouriteCuisines?: string[];
  /** The signed-in user's avoided ingredients (Preferences) — a hard exclusion. */
  avoidedIngredients?: string[];
  /** One pre-built sentence of soft goal guidance (goal-guidance.ts), or undefined. */
  goalGuidance?: string;
}

export interface PlanGenerationInput {
  days: number;
  budgetPence?: number;
  favouriteCuisines?: string[];
  avoidedIngredients?: string[];
  /**
   * Free-text steer, e.g. "something with fish", "Nigerian food this week",
   * "no rice". Used both by Plan Ahead's per-day "replace with something
   * specific" action (days=1) and by the initial multi-day plan prompt
   * (days>1) — the message built below already phrases either case
   * correctly ("this day" vs "these days").
   */
  focus?: string;
  /** One pre-built sentence of soft goal guidance (goal-guidance.ts), or undefined. */
  goalGuidance?: string;
  /**
   * Demo mode only (no ANTHROPIC_API_KEY). When true, a `focus` that matches
   * nothing in the small curated pool falls back to a generic plan rather
   * than returning nothing — so building a whole plan is never a dead end.
   * The initial `generate` and the whole-plan `regeneratePlan` set this; the
   * single-day "replace with something specific" flow leaves it off, since
   * an honest "couldn't find that" is the right answer there.
   */
  allowGenericFallback?: boolean;
}

export interface RawScannedItem {
  name: unknown;
  quantity?: unknown;
  unit?: unknown;
}

export interface RawFoodContentIngredient {
  name: unknown;
  note?: unknown;
}

export interface RawFoodContentResult {
  dishName: unknown;
  // Expected to be RawFoodContentIngredient[], but kept unknown here and
  // narrowed defensively in sanitizeFoodContent (scan-validation.ts) — same
  // pattern as RawScannedItem, nothing the model returns is trusted shape.
  ingredients: unknown;
}

export type ScanImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

const SAFETY_RULES = `Never claim a recipe is "safe" for any allergy, intolerance, or medical condition, and never state or imply a recipe is medically appropriate. You may only describe what ingredients a recipe contains. Do not repeat the same ingredient twice within one recipe's ingredients list. Every recipe must have at least 2 steps and a positive cookTimeMinutes and servings.`;

// The curated recipe pool (CURATED_RECIPES) and its keyword matcher now live
// in ./curated-recipes.ts — shared with the guest path, which must never call
// a live model (see that file). This service still uses them for its own
// no-ANTHROPIC_API_KEY demo fallback, unchanged.

const COOK_TODAY_SYSTEM_PROMPT = `You are the recipe-generation component inside FoodPadi, a UK food companion app. You are called only for the "Cook Today" feature: a user has told you what ingredients they have, and optionally a time limit and serving count.

Rules you must follow:
- Return ONLY valid JSON, no prose before or after it, matching exactly this shape:
  {"recipes": [{"title": string, "cookTimeMinutes": number, "servings": number, "cuisine": string | null, "ingredients": [{"name": string, "quantity": string | null, "unit": string | null}], "steps": [string, ...]}]}
- Return between 2 and 3 recipes.
- Prefer recipes that use mostly the ingredients the user listed. You may assume common pantry staples (salt, pepper, oil, water) are available even if not listed, but do not assume specialty or allergen-relevant ingredients (dairy, nuts, gluten-containing items, etc.) are available unless the user listed them or a very close equivalent.
- If a time constraint is given, every recipe's cookTimeMinutes must be at or under that limit.
- If a favourite-cuisine list is given, lean toward it where it fits the ingredients, but don't force every recipe into those cuisines.
- If an avoided-ingredients list is given, do not include any of those ingredients in any recipe.
- If food goals are given, treat them as soft steering only — never state or imply a recipe is healthy, medical, or weight-loss related.
- ${SAFETY_RULES}`;

const PLAN_AHEAD_SYSTEM_PROMPT = `You are the meal-planning component inside FoodPadi, a UK food companion app. You are called only for the "Plan Ahead" feature: a user wants a dinner planned for each of several days.

Rules you must follow:
- Return ONLY valid JSON, no prose before or after it, matching exactly this shape:
  {"recipes": [{"title": string, "cookTimeMinutes": number, "servings": number, "cuisine": string | null, "ingredients": [{"name": string, "quantity": string | null, "unit": string | null}], "steps": [string, ...]}]}
- Return exactly the number of dinner recipes requested, one per day, in the order the days occur.
- Vary the meals across days — do not repeat the same dish, and prefer a reasonable spread of cuisines unless the user's favourites suggest otherwise.
- Reuse a few common ingredients across days where sensible (this helps a consolidated shopping list stay short), but do not force artificial repetition.
- If a favourite-cuisine list is given, lean toward it but don't restrict every meal to only those cuisines.
- If an avoided-ingredients list is given, do not include any of those ingredients in any recipe.
- If a weekly budget is given, treat it as a soft steering hint toward simpler, less expensive ingredients — you have no real pricing data, so never state or imply an exact cost.
- If food goals are given, treat them as soft steering only — never state or imply a plan is healthy, medical, or weight-loss related.
- ${SAFETY_RULES}`;

const SCAN_SYSTEM_PROMPT = `You are the food-recognition component inside FoodPadi, a UK food companion app. You are shown a photo of food — a fridge, cupboard, shopping bag, or receipt — and must identify what food and drink items are visible.

Rules you must follow:
- Return ONLY valid JSON, no prose before or after it, matching exactly this shape:
  {"items": [{"name": string, "quantity": string | null, "unit": string | null}]}
- Only include food or drink items you can actually see or read. Do not guess at items that aren't visible.
- Use generic names (e.g. "baked beans", "semi-skimmed milk"), not specific brand names, unless the brand name is the clearest way to describe a distinctive product.
- Do not estimate expiry dates, freshness, or safety — you are identifying what is present, nothing more.
- If you cannot identify any food items in the photo, return {"items": []}.`;

const FOOD_CONTENT_SYSTEM_PROMPT = `You are the food-recognition component inside FoodPadi, a UK food companion app. You are shown a photo of a prepared dish — a meal, a plate of food, something ready to eat — and must identify what the dish is and what it is typically made of.

Rules you must follow:
- Return ONLY valid JSON, no prose before or after it, matching exactly this shape:
  {"dishName": string, "ingredients": [{"name": string, "note": string | null}]}
- "dishName" is your best-guess name for the dish (e.g. "Jollof rice with chicken"). If you can't identify a specific dish, use a short general description (e.g. "Grilled meat with vegetables") instead of guessing a specific name.
- "ingredients" is the TYPICAL composition of this dish, based on how it looks and how it is commonly made — not a claim about exactly what is in this specific plate. List the most prominent/likely items first, at most 12.
- Set "note" to a short phrase (e.g. "commonly used, not directly visible") for any ingredient you are inferring rather than actually seeing — oils, stock, seasoning, sauces mixed through the dish, etc. Set it to null for anything clearly visible.
- Never state or imply certainty about hidden ingredients, allergens, or exact quantities — you are estimating, not verifying.
- If you cannot identify any food in the photo, return {"dishName": "", "ingredients": []}.`;

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ServiceUnavailableException(
        'This feature is not available yet — no ANTHROPIC_API_KEY is configured.',
      );
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  private curatedFallback(count: number, hint?: string): RawRecipeCandidate[] {
    this.logger.warn(`ANTHROPIC_API_KEY not set — serving ${count} curated recipe(s) instead of a live AI call.`);

    if (!hint?.trim()) {
      return Array.from({ length: count }, (_, i) => CURATED_RECIPES[i % CURATED_RECIPES.length]);
    }

    // Deliberately NOT topped up to `count` when matches are thin or absent
    // — a real hint (e.g. "spicy pizza") with zero curated recipes about
    // pizza should return nothing here rather than pad with unrelated
    // filler. DecideService already handles a short/empty cook-option list by
    // leaning on Eat Now's "get it" results instead, so an honest empty
    // result is the safer failure mode than a confidently wrong one. (The
    // guest path uses pickCuratedRecipes in ./curated-recipes.ts, which DOES
    // top up — a guest with no "get it" fallback must never see nothing.)
    return scoreCuratedByHint(hint).slice(0, count).map((s) => s.recipe);
  }

  // Plan Ahead's demo fallback. Unlike curatedFallback above, this ALWAYS
  // returns exactly `days` recipes: a whole meal plan failing to generate
  // just because a free-text steer ("Nigerian food") doesn't keyword-match
  // the curated pool is a dead end for the feature, not an honest-empty
  // result. Shared with the guest Plan Ahead preview (curated-recipes.ts).
  private curatedPlanFallback(days: number, hint?: string): RawRecipeCandidate[] {
    this.logger.warn(`ANTHROPIC_API_KEY not set — serving a ${days}-day curated plan.`);
    return curatedPlanForDays(days, hint);
  }

  // Used only for the "Replace with something specific" typeahead — the
  // titles a demo-mode (no ANTHROPIC_API_KEY) search can offer as picks that
  // are *guaranteed* to succeed, since curatedFallback matches against this
  // exact same pool. Picking a title the search never offered (an arbitrary
  // free-typed hint) can still legitimately come back empty — this just
  // stops that from being the *only* path, which is what the "type and
  // submit blind" UX was doing before.
  searchCuratedRecipeTitles(query: string, limit: number): string[] {
    if (!query.trim()) return [];
    return scoreCuratedByHint(query)
      .slice(0, limit)
      .map((s) => s.recipe.title)
      .filter((t): t is string => typeof t === 'string');
  }

  async generateCookTodayRecipes(input: CookTodayGenerationInput): Promise<RawRecipeCandidate[]> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.curatedFallback(3, input.ingredients.join(' '));
    }

    const userMessage = [
      `Ingredients I have: ${input.ingredients.join(', ')}.`,
      input.timeConstraintMinutes ? `I have at most ${input.timeConstraintMinutes} minutes to cook.` : null,
      input.servings ? `I need ${input.servings} servings.` : null,
      input.favouriteCuisines?.length ? `Favourite cuisines: ${input.favouriteCuisines.join(', ')}.` : null,
      input.avoidedIngredients?.length
        ? `Avoid these ingredients entirely: ${input.avoidedIngredients.join(', ')}.`
        : null,
      input.goalGuidance ?? null,
    ]
      .filter(Boolean)
      .join(' ');

    return this.callForRecipes(COOK_TODAY_SYSTEM_PROMPT, userMessage, 1500);
  }

  async generatePlanMeals(input: PlanGenerationInput): Promise<RawRecipeCandidate[]> {
    if (!process.env.ANTHROPIC_API_KEY) {
      // Building a whole plan (generate / regeneratePlan) must never come
      // back empty just because a free-text steer doesn't match the curated
      // dev set — curatedPlanFallback always returns `days` recipes. The
      // single-day "replace with something specific" flow keeps the honest
      // curatedFallback, so an unmatched request there says so.
      return input.allowGenericFallback
        ? this.curatedPlanFallback(input.days, input.focus)
        : this.curatedFallback(input.days, input.focus);
    }

    const userMessage = [
      `Plan dinner for ${input.days} day${input.days === 1 ? '' : 's'}.`,
      input.focus?.trim()
        ? `For ${input.days === 1 ? 'this day' : 'these days'} the user specifically wants: "${input.focus.trim()}". Honour that request as closely as you can while still following every rule above.`
        : null,
      input.favouriteCuisines?.length ? `Favourite cuisines: ${input.favouriteCuisines.join(', ')}.` : null,
      input.avoidedIngredients?.length ? `Avoid these ingredients entirely: ${input.avoidedIngredients.join(', ')}.` : null,
      input.budgetPence ? `Weekly food budget is roughly £${(input.budgetPence / 100).toFixed(2)}.` : null,
      input.goalGuidance ?? null,
    ]
      .filter(Boolean)
      .join(' ');

    return this.callForRecipes(PLAN_AHEAD_SYSTEM_PROMPT, userMessage, 400 + input.days * 500);
  }

  // No curated fallback here, unlike the two methods above — a specific
  // user's photo can't be honestly faked with generic placeholder content
  // the way a generic recipe suggestion can. Gates on ANTHROPIC_API_KEY via
  // getClient() and throws a plain 503 if it's unset.
  async analyzeFoodPhoto(imageBase64: string, mediaType: ScanImageMediaType): Promise<RawScannedItem[]> {
    const client = this.getClient();
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SCAN_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'What food or drink items can you identify in this photo?' },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new ServiceUnavailableException('The scanner returned an empty response.');
    }

    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      this.logger.error(`Failed to parse scan output as JSON: ${textBlock.text.slice(0, 500)}`);
      throw new ServiceUnavailableException('The scanner returned an unexpected format.');
    }

    if (!Array.isArray(parsed.items)) {
      throw new ServiceUnavailableException('The scanner returned an unexpected format.');
    }

    return parsed.items as RawScannedItem[];
  }

  // Same no-curated-fallback rationale as analyzeFoodPhoto above.
  async analyzeFoodContent(imageBase64: string, mediaType: ScanImageMediaType): Promise<RawFoodContentResult> {
    const client = this.getClient();
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: FOOD_CONTENT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'What dish is this, and what is it likely made of?' },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new ServiceUnavailableException('The scanner returned an empty response.');
    }

    let parsed: { dishName?: unknown; ingredients?: unknown };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      this.logger.error(`Failed to parse food-content output as JSON: ${textBlock.text.slice(0, 500)}`);
      throw new ServiceUnavailableException('The scanner returned an unexpected format.');
    }

    if (typeof parsed.dishName !== 'string' || !Array.isArray(parsed.ingredients)) {
      throw new ServiceUnavailableException('The scanner returned an unexpected format.');
    }

    return parsed as RawFoodContentResult;
  }

  private async callForRecipes(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
  ): Promise<RawRecipeCandidate[]> {
    const client = this.getClient();
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new ServiceUnavailableException('The recipe generator returned an empty response.');
    }

    let parsed: { recipes?: unknown };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      this.logger.error(`Failed to parse model output as JSON: ${textBlock.text.slice(0, 500)}`);
      throw new ServiceUnavailableException('The recipe generator returned an unexpected format.');
    }

    if (!Array.isArray(parsed.recipes)) {
      throw new ServiceUnavailableException('The recipe generator returned an unexpected format.');
    }

    return parsed.recipes as RawRecipeCandidate[];
  }
}
