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
  /**
   * Free-text steer for a single-day replacement — e.g. "something with fish",
   * "a quick pasta", "vegetarian". Used by Plan Ahead's per-day "replace with
   * something specific" action; ignored for a normal multi-day plan.
   */
  focus?: string;
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
      'Soft-boil the eggs in a separate pan of simmering water for 6-7 minutes, then cool under cold water and peel.',
      'Bring the stock to a simmer and whisk in the miso paste.',
      'Add the mushrooms and cook for 5 minutes, then cook the noodles in the broth.',
      'Serve topped with the halved soft-boiled eggs and sliced spring onion.',
    ],
  },
  {
    title: 'Chicken & Avocado Salad',
    cookTimeMinutes: 15,
    servings: 2,
    cuisine: 'International',
    ingredients: [
      { name: 'chicken breast', quantity: '2', unit: null },
      { name: 'mixed salad leaves', quantity: '100', unit: 'g' },
      { name: 'avocado', quantity: '1', unit: null },
      { name: 'cherry tomatoes', quantity: '150', unit: 'g' },
      { name: 'cucumber', quantity: '0.5', unit: null },
      { name: 'olive oil', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Grill or pan-fry the chicken breast until cooked through, then slice.',
      'Toss the salad leaves, tomatoes and cucumber with olive oil.',
      'Top with the sliced chicken and avocado.',
    ],
  },
  {
    title: 'Greek Salad',
    cookTimeMinutes: 10,
    servings: 2,
    cuisine: 'Mediterranean',
    ingredients: [
      { name: 'cucumber', quantity: '1', unit: null },
      { name: 'tomatoes', quantity: '3', unit: null },
      { name: 'red onion', quantity: '0.5', unit: null },
      { name: 'feta cheese', quantity: '150', unit: 'g' },
      { name: 'olives', quantity: '80', unit: 'g' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
    ],
    steps: [
      'Chop the cucumber, tomatoes and red onion into chunks.',
      'Toss with the olives and olive oil.',
      'Top with crumbled feta and serve.',
    ],
  },
  {
    title: 'Loaded Jacket Potato',
    cookTimeMinutes: 60,
    servings: 2,
    cuisine: 'British',
    ingredients: [
      { name: 'baking potatoes', quantity: '2', unit: null },
      { name: 'baked beans', quantity: '1', unit: 'tin' },
      { name: 'cheddar cheese', quantity: '80', unit: 'g' },
      { name: 'butter', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Prick the potatoes and bake at 200°C for about 50-60 minutes until soft.',
      'Warm the baked beans.',
      'Split the potatoes open, top with butter, beans and grated cheese.',
    ],
  },
  {
    title: 'Chicken & Vegetable Stir Fry',
    cookTimeMinutes: 20,
    servings: 2,
    cuisine: 'Chinese',
    ingredients: [
      { name: 'chicken breast', quantity: '2', unit: null },
      { name: 'mixed stir-fry vegetables', quantity: '300', unit: 'g' },
      { name: 'soy sauce', quantity: '2', unit: 'tbsp' },
      { name: 'garlic', quantity: '2 cloves', unit: null },
      { name: 'ginger', quantity: '1 thumb', unit: null },
      { name: 'rice', quantity: '200', unit: 'g' },
    ],
    steps: [
      'Cook the rice according to packet instructions.',
      'Slice the chicken and stir-fry in a hot pan or wok until cooked through.',
      'Add the garlic, ginger and vegetables, stir-fry for 3-4 minutes.',
      'Stir in the soy sauce and serve over the cooked rice.',
    ],
  },
  {
    title: 'Veggie Bean Chilli',
    cookTimeMinutes: 30,
    servings: 4,
    cuisine: 'Mexican',
    ingredients: [
      { name: 'kidney beans', quantity: '2 tins', unit: null },
      { name: 'tinned tomatoes', quantity: '400', unit: 'g' },
      { name: 'onion', quantity: '1', unit: null },
      { name: 'pepper', quantity: '1', unit: null },
      { name: 'chilli powder', quantity: '1', unit: 'tbsp' },
      { name: 'rice', quantity: '250', unit: 'g' },
    ],
    steps: [
      'Cook the rice according to packet instructions.',
      'Soften the onion and pepper, then stir in the chilli powder.',
      'Add the kidney beans and tinned tomatoes, simmer for 20 minutes.',
      'Serve with the cooked rice.',
    ],
  },
  {
    title: 'Egg Fried Rice',
    cookTimeMinutes: 15,
    servings: 2,
    cuisine: 'Chinese',
    ingredients: [
      { name: 'cooked rice', quantity: '300', unit: 'g' },
      { name: 'egg', quantity: '2', unit: null },
      { name: 'frozen peas', quantity: '100', unit: 'g' },
      { name: 'spring onion', quantity: '2', unit: null },
      { name: 'soy sauce', quantity: '1', unit: 'tbsp' },
    ],
    steps: [
      'Scramble the eggs in a hot pan or wok, then set aside.',
      'Fry the rice and peas for a few minutes until hot through.',
      'Stir the egg back in with the soy sauce and spring onion.',
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

  // `hint` is free text describing what the user actually asked for (their
  // ingredients/description) — without it, this always returned the same
  // first few recipes regardless of the request (e.g. "salad" got chicken &
  // rice). Simple keyword-in-title-or-ingredient matching, same idea as
  // EatNowService's matcher but far smaller in scope: this is a fallback
  // demo dataset, not a search engine.
  private curatedFallback(count: number, hint?: string): RawRecipeCandidate[] {
    this.logger.warn(`ANTHROPIC_API_KEY not set — serving ${count} curated recipe(s) instead of a live AI call.`);

    if (!hint?.trim()) {
      return Array.from({ length: count }, (_, i) => CURATED_RECIPES[i % CURATED_RECIPES.length]);
    }

    const words = hint
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);

    const scored = CURATED_RECIPES.map((recipe) => {
      const haystack = `${recipe.title} ${(recipe.ingredients as { name: string }[]).map((i) => i.name).join(' ')}`.toLowerCase();
      const score = words.reduce((s, w) => (haystack.includes(w) ? s + 1 : s), 0);
      return { recipe, score };
    });

    const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

    // Deliberately NOT topped up to `count` when matches are thin or absent
    // — a real hint (e.g. "spicy pizza") with zero curated recipes about
    // pizza should return nothing here rather than pad with unrelated
    // filler (this dataset is a dozen fixed dev recipes and was backfilling
    // with completely unrelated dishes whenever nothing matched). DecideService
    // already handles a short/empty cook-option list by leaning on Eat Now's
    // "get it" results instead, so an honest empty result is the safer
    // failure mode than a confidently wrong one.
    return matched.slice(0, count).map((s) => s.recipe);
  }

  async generateCookTodayRecipes(input: CookTodayGenerationInput): Promise<RawRecipeCandidate[]> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.curatedFallback(3, input.ingredients.join(' '));
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
      // A focused single-day replace ("something with fish") keyword-matches
      // the curated set the same way Cook Today's hint does; a plain plan
      // request has nothing to match on and takes the round-robin path.
      return this.curatedFallback(input.days, input.focus);
    }

    const userMessage = [
      `Plan dinner for ${input.days} day${input.days === 1 ? '' : 's'}.`,
      input.focus?.trim()
        ? `For ${input.days === 1 ? 'this day' : 'these days'} the user specifically wants: "${input.focus.trim()}". Honour that request as closely as you can while still following every rule above.`
        : null,
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
