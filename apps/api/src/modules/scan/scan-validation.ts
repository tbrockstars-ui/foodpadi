import { RawScannedItem } from '../ai/claude.service';

export interface ScannedItemView {
  name: string;
  quantity: string | null;
  unit: string | null;
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
