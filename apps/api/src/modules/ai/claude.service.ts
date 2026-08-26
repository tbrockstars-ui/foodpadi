import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

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
}

export interface PlanGenerationInput {
  days: number;
  budgetPence?: number;
  favouriteCuisines?: string[];
  avoidedIngredients?: string[];
}

const SAFETY_RULES = `Never claim a recipe is "safe" for any allergy, intolerance, or medical condition, and never state or imply a recipe is medically appropriate. You may only describe what ingredients a recipe contains. Do not repeat the same ingredient twice within one recipe's ingredients list. Every recipe must have at least 2 steps and a positive cookTimeMinutes and servings.`;

const COOK_TODAY_SYSTEM_PROMPT = `You are the recipe-generation component inside FoodPadi, a UK food companion app. You are called only for the "Cook Today" feature: a user has told you what ingredients they have, and optionally a time limit and serving count.

Rules you must follow:
- Return ONLY valid JSON, no prose before or after it, matching exactly this shape:
  {"recipes": [{"title": string, "cookTimeMinutes": number, "servings": number, "cuisine": string | null, "ingredients": [{"name": string, "quantity": string | null, "unit": string | null}], "steps": [string, ...]}]}
- Return between 2 and 3 recipes.
- Prefer recipes that use mostly the ingredients the user listed. You may assume common pantry staples (salt, pepper, oil, water) are available even if not listed, but do not assume specialty or allergen-relevant ingredients (dairy, nuts, gluten-containing items, etc.) are available unless the user listed them or a very close equivalent.
- If a time constraint is given, every recipe's cookTimeMinutes must be at or under that limit.
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
- ${SAFETY_RULES}`;

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

  async generateCookTodayRecipes(input: CookTodayGenerationInput): Promise<RawRecipeCandidate[]> {
    const userMessage = [
      `Ingredients I have: ${input.ingredients.join(', ')}.`,
      input.timeConstraintMinutes ? `I have at most ${input.timeConstraintMinutes} minutes to cook.` : null,
      input.servings ? `I need ${input.servings} servings.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return this.callForRecipes(COOK_TODAY_SYSTEM_PROMPT, userMessage, 1500);
  }

  async generatePlanMeals(input: PlanGenerationInput): Promise<RawRecipeCandidate[]> {
    const userMessage = [
      `Plan dinner for ${input.days} day${input.days === 1 ? '' : 's'}.`,
      input.favouriteCuisines?.length ? `Favourite cuisines: ${input.favouriteCuisines.join(', ')}.` : null,
      input.avoidedIngredients?.length ? `Avoid these ingredients entirely: ${input.avoidedIngredients.join(', ')}.` : null,
      input.budgetPence ? `Weekly food budget is roughly £${(input.budgetPence / 100).toFixed(2)}.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return this.callForRecipes(PLAN_AHEAD_SYSTEM_PROMPT, userMessage, 400 + input.days * 500);
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
