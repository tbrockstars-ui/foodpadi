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

const SYSTEM_PROMPT = `You are the recipe-generation component inside FoodPadi, a UK food companion app. You are called only for the "Cook Today" feature: a user has told you what ingredients they have, and optionally a time limit and serving count.

Rules you must follow:
- Return ONLY valid JSON, no prose before or after it, matching exactly this shape:
  {"recipes": [{"title": string, "cookTimeMinutes": number, "servings": number, "cuisine": string | null, "ingredients": [{"name": string, "quantity": string | null, "unit": string | null}], "steps": [string, ...]}]}
- Return between 2 and 3 recipes.
- Prefer recipes that use mostly the ingredients the user listed. You may assume common pantry staples (salt, pepper, oil, water) are available even if not listed, but do not assume specialty or allergen-relevant ingredients (dairy, nuts, gluten-containing items, etc.) are available unless the user listed them or a very close equivalent.
- If a time constraint is given, every recipe's cookTimeMinutes must be at or under that limit.
- Never claim a recipe is "safe" for any allergy, intolerance, or medical condition, and never state or imply a recipe is medically appropriate. You may only describe what ingredients a recipe contains.
- Do not repeat the same ingredient twice within one recipe's ingredients list.
- Every recipe must have at least 2 steps and a positive cookTimeMinutes and servings.`;

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ServiceUnavailableException(
        'Cook Today is not available yet — no ANTHROPIC_API_KEY is configured.',
      );
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async generateCookTodayRecipes(input: CookTodayGenerationInput): Promise<RawRecipeCandidate[]> {
    const client = this.getClient();
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

    const userMessage = [
      `Ingredients I have: ${input.ingredients.join(', ')}.`,
      input.timeConstraintMinutes ? `I have at most ${input.timeConstraintMinutes} minutes to cook.` : null,
      input.servings ? `I need ${input.servings} servings.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
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
