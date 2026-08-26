import { Logger } from '@nestjs/common';
import { RawRecipeCandidate } from './claude.service';

export interface RecipeIngredientView {
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface RecipeView {
  title: string;
  cookTimeMinutes: number;
  servings: number;
  cuisine: string | null;
  ingredients: RecipeIngredientView[];
  steps: string[];
}

const logger = new Logger('RecipeValidation');

/**
 * Layer 3 — nothing an LLM (Layer 5) returns reaches the user, or a Recipe
 * row, unless it passes these deterministic sanity checks (docs/
 * AI_ARCHITECTURE.md, docs/TEST_STRATEGY.md's AI eval requirements: no
 * negative/zero time or servings, no empty steps, no duplicate ingredients
 * within one recipe). Shared by Cook Today and Plan Ahead — both generate
 * recipes via the same Claude integration and must apply the same gate.
 */
export function sanitizeRecipeCandidate(
  candidate: RawRecipeCandidate,
  timeLimit?: number,
): RecipeView | null {
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const cookTimeMinutes = Number(candidate.cookTimeMinutes);
  const servings = Number(candidate.servings);
  const cuisine = typeof candidate.cuisine === 'string' ? candidate.cuisine : null;
  const steps = Array.isArray(candidate.steps)
    ? candidate.steps.filter((step): step is string => typeof step === 'string' && step.trim().length > 0)
    : [];
  const rawIngredients = Array.isArray(candidate.ingredients) ? candidate.ingredients : [];

  const ingredients: RecipeIngredientView[] = [];
  const seenNames = new Set<string>();
  for (const item of rawIngredients) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) continue;
    const normalized = name.toLowerCase();
    if (seenNames.has(normalized)) continue; // no duplicate ingredients within one recipe
    seenNames.add(normalized);
    ingredients.push({
      name,
      quantity: typeof record.quantity === 'string' ? record.quantity : null,
      unit: typeof record.unit === 'string' ? record.unit : null,
    });
  }

  if (
    !title ||
    !Number.isFinite(cookTimeMinutes) ||
    cookTimeMinutes <= 0 ||
    !Number.isFinite(servings) ||
    servings <= 0 ||
    steps.length < 2 ||
    ingredients.length === 0
  ) {
    logger.warn(`Dropped an invalid recipe candidate: ${JSON.stringify(candidate).slice(0, 300)}`);
    return null;
  }

  if (timeLimit && cookTimeMinutes > timeLimit) {
    logger.warn(`Dropped a recipe exceeding the requested time limit: "${title}"`);
    return null;
  }

  return { title, cookTimeMinutes, servings, cuisine, ingredients, steps };
}
