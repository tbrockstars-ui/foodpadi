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
  /** Cook Today only — one entry per step (same length as `steps`), seconds
   * for a step with a genuine duration, null for one that doesn't have a
   * reliable timer. Absent entirely for Plan Ahead / curated / guest
   * recipes, which never had this asked of them — the client falls back to
   * its own best-effort text guess in that case. */
  stepDurationsSeconds?: (number | null)[];
  /** Cook Today only — the prep-only portion of cookTimeMinutes, when the AI
   * could genuinely estimate one. Absent for Plan Ahead / curated / guest
   * recipes, and for any Cook Today recipe with no distinct prep phase — the
   * client shows only the plain total in that case, same as before this
   * field existed. Always strictly less than cookTimeMinutes (see
   * sanitizePrepTimeMinutes), so `cookTimeMinutes - prepTimeMinutes` is
   * always a positive "active cook" figure when present. */
  prepTimeMinutes?: number;
}

const MAX_STEP_DURATION_SECONDS = 3 * 60 * 60; // 3 hours — generous ceiling, never a fabricated marathon step

/**
 * Validates the optional stepDurationsSeconds candidate against an already-
 * accepted `steps` array. Never partially trusted: any mismatch (wrong
 * length, non-finite, negative, absurdly long) drops the WHOLE field for
 * this recipe rather than keeping some entries and guessing at others — the
 * recipe itself is still kept, the client just falls back to its own
 * best-effort text guess for every step, same as it does when the field is
 * absent entirely.
 */
function sanitizeStepDurations(candidate: unknown, stepCount: number): (number | null)[] | undefined {
  if (!Array.isArray(candidate) || candidate.length !== stepCount) return undefined;
  const durations: (number | null)[] = [];
  for (const entry of candidate) {
    if (entry === null) {
      durations.push(null);
      continue;
    }
    const seconds = Number(entry);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_STEP_DURATION_SECONDS) return undefined;
    durations.push(Math.round(seconds));
  }
  return durations;
}

/**
 * Validates the optional prepTimeMinutes candidate against the already-
 * accepted `cookTimeMinutes`. Never partially trusted: not-a-number, zero or
 * negative, or a prep time that isn't strictly less than the total (e.g. the
 * AI mistakenly repeats cookTimeMinutes, or claims a prep phase longer than
 * the whole recipe) drops the field entirely rather than showing a
 * nonsensical or zero-length "cook" portion — the recipe itself is still
 * kept, the client just falls back to showing the plain total, same as when
 * the field is absent entirely.
 */
function sanitizePrepTimeMinutes(candidate: unknown, cookTimeMinutes: number): number | undefined {
  if (candidate === null || candidate === undefined) return undefined;
  const minutes = Number(candidate);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes >= cookTimeMinutes) return undefined;
  return Math.round(minutes);
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

  const stepDurationsSeconds = sanitizeStepDurations(candidate.stepDurationsSeconds, steps.length);
  const prepTimeMinutes = sanitizePrepTimeMinutes(candidate.prepTimeMinutes, cookTimeMinutes);

  return { title, cookTimeMinutes, servings, cuisine, ingredients, steps, stepDurationsSeconds, prepTimeMinutes };
}
