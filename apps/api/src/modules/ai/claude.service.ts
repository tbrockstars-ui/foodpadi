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

export interface RawScannedItem {
  name: unknown;
  quantity?: unknown;
  unit?: unknown;
}

export type ScanImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

const SAFETY_RULES = `Never claim a recipe is "safe" for any allergy, intolerance, or medical condition, and never state or imply a recipe is medically appropriate. You may only describe what ingredients a recipe contains. Do not repeat the same ingredient twice within one recipe's ingredients list. Every recipe must have at least 2 steps and a positive cookTimeMinutes and servings.`;

// MVP fallback: with no ANTHROPIC_API_KEY configured, serve these instead of
// a 503 so Cook Today / Plan Ahead can be built and demoed end-to-end on a
// curated dataset. Passes the same Layer 3 validation (recipe-validation.ts)
// as a real model response. Swap to live AI by setting ANTHROPIC_API_KEY —
// no code change needed, getClient() below picks it up automatically.
const CURATED_RECIPES: RawRecipeCandidate[] = [
  {
    title: 'One-Pot Chicken & Rice',
    cookTimeMinutes: 35,
    servings: 4,
    cuisine: 'British',
    ingredients: [
      { name: 'chicken thighs', quantity: '4', unit: null },
      { name: 'rice', quantity: '300', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'chicken stock', quantity: '600', unit: 'ml' },
      { name: 'carrot', quantity: '2', unit: null },
    ],
    steps: [
      'Brown the chicken thighs in a large pot, then set aside.',
      'Soften the onion, garlic and carrot in the same pot.',
      'Stir in the rice, pour over the stock, and nestle the chicken back in.',
      'Cover and simmer for 20 minutes until the rice is tender and chicken is cooked through.',
    ],
  },
  {
    title: 'Tomato & Basil Pasta',
    cookTimeMinutes: 20,
    servings: 2,
    cuisine: 'Italian',
    ingredients: [
      { name: 'pasta', quantity: '200', unit: 'g' },
      { name: 'tinned tomatoes', quantity: '400', unit: 'g' },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'basil', quantity: 'a handful', unit: null },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'parmesan', quantity: '30', unit: 'g' },
    ],
    steps: [
      'Cook the pasta in salted boiling water until al dente.',
      'Fry the garlic gently in olive oil, then add the tinned tomatoes and simmer for 10 minutes.',
      'Toss the drained pasta through the sauce, top with torn basil and grated parmesan.',
    ],
  },
  {
    title: 'Chickpea & Spinach Curry',
    cookTimeMinutes: 30,
    servings: 3,
    cuisine: 'Indian',
    ingredients: [
      { name: 'chickpeas', quantity: '2 tins', unit: null },
      { name: 'spinach', quantity: '150', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'curry powder', quantity: '2', unit: 'tbsp' },
      { name: 'coconut milk', quantity: '400', unit: 'ml' },
      { name: 'ginger', quantity: '1 thumb', unit: null },
    ],
    steps: [
      'Soften the onion and ginger, then stir in the curry powder for a minute.',
      'Add the chickpeas and coconut milk, simmer for 15 minutes.',
      'Stir through the spinach until wilted, then serve with rice or flatbread.',
    ],
  },
  {
    title: 'Sheet-Pan Salmon & Veg',
    cookTimeMinutes: 25,
    servings: 2,
    cuisine: 'Mediterranean',
    ingredients: [
      { name: 'salmon fillets', quantity: '2', unit: null },
      { name: 'courgette', quantity: '1', unit: null },
      { name: 'cherry tomatoes', quantity: '200', unit: 'g' },
      { name: 'lemon', quantity: '1', unit: null },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      'Toss the courgette and cherry tomatoes with olive oil on a baking tray.',
      'Roast for 10 minutes, then add the salmon fillets and lemon slices on top.',
      'Roast for a further 12-15 minutes until the salmon is cooked through.',
    ],
  },
  {
    title: 'Beef & Black Bean Tacos',
    cookTimeMinutes: 25,
    servings: 4,
    cuisine: 'Mexican',
    ingredients: [
      { name: 'beef mince', quantity: '400', unit: 'g' },
      { name: 'black beans', quantity: '1 tin', unit: null },
      { name: 'taco seasoning', quantity: '1 packet', unit: null },
      { name: 'tortillas', quantity: '8', unit: null },
      { name: 'lettuce', quantity: 'a handful', unit: null },
      { name: 'cheese', quantity: '80', unit: 'g' },
    ],
    steps: [
      'Brown the beef mince in a pan, draining any excess fat.',
      'Stir in the taco seasoning and black beans, simmer for 5 minutes.',
      'Warm the tortillas and fill with the beef mixture, lettuce and cheese.',
    ],
  },
  {
    title: 'Miso Noodle Soup',
    cookTimeMinutes: 20,
    servings: 2,
    cuisine: 'Japanese',
    ingredients: [
      { name: 'noodles', quantity: '150', unit: 'g' },
      { name: 'miso paste', quantity: '2', unit: 'tbsp' },
      { name: 'spring onion', quantity: '2', unit: null },
      { name: 'mushroom', quantity: '100', unit: 'g' },
      { name: 'egg', quantity: '2', unit: null },
      { name: 'vegetable stock', quantity: '600', unit: 'ml' },
    ],
    steps: [
      'Bring the stock to a simmer and whisk in the miso paste.',
      'Add the mushrooms and cook for 5 minutes, then cook the noodles in the broth.',
      'Serve topped with a soft-boiled egg and sliced spring onion.',
    ],
  },
];

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

const SCAN_SYSTEM_PROMPT = `You are the food-recognition component inside FoodPadi, a UK food companion app. You are shown a photo of food — a fridge, cupboard, shopping bag, or receipt — and must identify what food and drink items are visible.

Rules you must follow:
- Return ONLY valid JSON, no prose before or after it, matching exactly this shape:
  {"items": [{"name": string, "quantity": string | null, "unit": string | null}]}
- Only include food or drink items you can actually see or read. Do not guess at items that aren't visible.
- Use generic names (e.g. "baked beans", "semi-skimmed milk"), not specific brand names, unless the brand name is the clearest way to describe a distinctive product.
- Do not estimate expiry dates, freshness, or safety — you are identifying what is present, nothing more.
- If you cannot identify any food items in the photo, return {"items": []}.`;

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

  private curatedFallback(count: number): RawRecipeCandidate[] {
    this.logger.warn(`ANTHROPIC_API_KEY not set — serving ${count} curated recipe(s) instead of a live AI call.`);
    return Array.from({ length: count }, (_, i) => CURATED_RECIPES[i % CURATED_RECIPES.length]);
  }

  async generateCookTodayRecipes(input: CookTodayGenerationInput): Promise<RawRecipeCandidate[]> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.curatedFallback(3);
    }

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
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.curatedFallback(input.days);
    }

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
