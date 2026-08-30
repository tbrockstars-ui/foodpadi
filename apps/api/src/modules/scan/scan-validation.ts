import { RawFoodContentResult, RawScannedItem } from '../ai/claude.service';

export interface ScannedItemView {
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface FoodContentIngredientView {
  name: string;
  note: string | null;
}

export interface FoodContentView {
  dishName: string;
  ingredients: FoodContentIngredientView[];
}

/**
 * Layer 3 for scan output — same non-negotiable pattern as recipe-validation.ts:
 * nothing the model returns reaches the review screen unless it passes these
 * deterministic checks (non-empty name, no duplicates within one scan).
 */
export function sanitizeScannedItems(items: RawScannedItem[]): ScannedItemView[] {
  const seen = new Set<string>();
  const result: ScannedItemView[] = [];

  for (const item of items) {
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) continue;
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({
      name,
      quantity: typeof item.quantity === 'string' ? item.quantity : null,
      unit: typeof item.unit === 'string' ? item.unit : null,
    });
  }

  return result;
}

const FOOD_CONTENT_INGREDIENT_LIMIT = 12;

/**
 * Same non-negotiable pattern as sanitizeScannedItems above — nothing the
 * model returns for the "what's in this dish?" mode reaches the UI unless
 * it passes these deterministic checks (non-empty name, no duplicates,
 * capped length).
 */
export function sanitizeFoodContent(raw: RawFoodContentResult): FoodContentView {
  const dishName = typeof raw.dishName === 'string' ? raw.dishName.trim() : '';

  const seen = new Set<string>();
  const ingredients: FoodContentIngredientView[] = [];
  const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];

  for (const item of rawIngredients) {
    if (ingredients.length >= FOOD_CONTENT_INGREDIENT_LIMIT) break;
    if (!item || typeof item !== 'object') continue;
    const candidate = item as { name?: unknown; note?: unknown };
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name) continue;
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const note = typeof candidate.note === 'string' && candidate.note.trim() ? candidate.note.trim() : null;
    ingredients.push({ name, note });
  }

  return { dishName, ingredients };
}
