// Cooking Journey — the small pure helpers both apps and the API share for a
// persistent, resumable cook: turning a stored journey row into "where should
// Resume take the user", and computing a step timer's remaining seconds from
// stored timestamps rather than a live setInterval counter (brief §19, §27).
//
// Same spirit as planTiming.ts: deterministic, no I/O, `now` injectable for
// tests. The server is the source of truth for the journey; these functions
// only interpret it.

export type CookingJourneyStage =
  | 'recipe_selected'
  | 'ingredient_check'
  | 'shopping'
  | 'ready_to_cook'
  | 'cooking'
  | 'feedback_pending';

export type CookingJourneyStatus = 'active' | 'completed' | 'cancelled' | 'abandoned';

export type CookingJourneyDestination =
  | 'cooking'
  | 'shopping'
  | 'ingredient_check'
  | 'ready_to_cook'
  | 'recipe_selected'
  | 'feedback_pending';

export type CookingTimerStatus = 'running' | 'paused' | 'done';

/** The persisted timer fields, as ISO strings (how they cross the wire). */
export interface CookingTimerState {
  status: CookingTimerStatus | null;
  /** The step's full duration — for the "M:SS" label and for reset. */
  durationSeconds: number | null;
  /** Wall-clock target while running (ISO). Null when paused/idle/done. */
  endsAt: string | null;
  /** Frozen seconds left, written when the timer is paused. */
  remainingSeconds: number | null;
}

/**
 * Where "Resume" should land the user for this journey. Priority order is the
 * brief's §27 list: an in-progress cook wins over everything, then an
 * outstanding shop, then ingredient confirmation, then ready-to-cook, then a
 * bare recipe selection, then an awaited rating.
 *
 * `shoppingComplete` is derived by the caller from the linked shopping list
 * (every item checked) and passed in, so this stays pure and has no notion of
 * list rows.
 */
export function resolveJourneyDestination(input: {
  stage: CookingJourneyStage;
  shoppingComplete?: boolean;
}): CookingJourneyDestination {
  const { stage, shoppingComplete = false } = input;

  if (stage === 'cooking') return 'cooking';
  if (stage === 'feedback_pending') return 'feedback_pending';
  if (stage === 'shopping') return shoppingComplete ? 'ready_to_cook' : 'shopping';
  if (stage === 'ready_to_cook') return 'ready_to_cook';
  if (stage === 'ingredient_check') return 'ingredient_check';
  return 'recipe_selected';
}

/**
 * Seconds left on a step timer, computed from stored state so it stays correct
 * across navigation, app backgrounding, close and reload — never a decremented
 * counter (brief §19). Returns 0 once elapsed or done.
 *
 * Model (mirrors the existing client CookingTimer's endAt/remaining approach):
 *  - running: `endsAt` is a wall-clock target; remaining = endsAt - now.
 *  - paused:  `remainingSeconds` is the frozen value written at pause time.
 *  - done / no status: 0.
 */
export function computeTimerRemaining(timer: CookingTimerState, now: Date = new Date()): number {
  if (!timer.status || timer.status === 'done') return 0;

  if (timer.status === 'paused') {
    return Math.max(0, Math.round(timer.remainingSeconds ?? 0));
  }

  // running
  if (!timer.endsAt) return Math.max(0, Math.round(timer.durationSeconds ?? 0));
  const remainingMs = new Date(timer.endsAt).getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.round(remainingMs / 1000);
}

/** True once every outstanding shopping item has been checked off (an empty
 * list counts as complete — nothing left to buy) — the signal that flips a
 * `shopping` journey to "ready to cook". Kept here so web, mobile and the API
 * agree on the rule. */
export function isShoppingComplete(items: { checked: boolean }[]): boolean {
  return items.every((item) => item.checked);
}

// ---------------------------------------------------------------------------
// Ingredient check — the full fridge-scan / comparison session, persisted on
// the journey so the user never has to rescan or re-tick after a
// logout/navigate/close (bug: FridgeCheck state was client-only + a lossy
// {have,need} projection with no rehydrate path). Structured JSON on
// CookingJourney.ingredientStatus; DB column name unchanged, view field is
// `ingredientState`.

/** Structurally identical to dto.ts's ScannedItemView — declared here to keep
 * this module import-free (dto.ts already depends on this file). */
export interface IngredientItem {
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface IngredientNeed {
  name: string;
  /** "1 more" shortfall note, or the recipe's own qty/unit, or null. */
  note: string | null;
}

export interface IngredientCheckState {
  v: 2;
  /** FridgeCheck's own sub-stage: reviewing the raw scan vs. comparison done. */
  subStage: 'reviewScan' | 'reconciled';
  /** The user chose Skip rather than scanning. */
  skipped: boolean;
  /** ISO of the last successful scan; null when skipped / never scanned. */
  scannedAt: string | null;
  /** Raw scanner output. Empty when skipped. */
  detected: IngredientItem[];
  /** Names of detected items the user KEEPS. `detected` minus these = REJECTED. */
  confirmedNames: string[];
  /** "I also have X" additions the user typed in. */
  manualHave: IngredientItem[];
  /** Recipe ingredient names the comparison marked as already covered. */
  haveNames: string[];
  /** Recipe ingredients still needed (with an optional shortfall note). */
  need: IngredientNeed[];
  /** "To buy" items ticked off — only meaningful before a shopping list row
   * exists; once CookingJourney.shoppingListId is set, ShoppingListItem.checked
   * is authoritative. */
  purchasedNames: string[];
}

export function emptyIngredientCheckState(): IngredientCheckState {
  return {
    v: 2,
    subStage: 'reviewScan',
    skipped: false,
    scannedAt: null,
    detected: [],
    confirmedNames: [],
    manualHave: [],
    haveNames: [],
    need: [],
    purchasedNames: [],
  };
}

function asItemArray(raw: unknown): IngredientItem[] {
  if (!Array.isArray(raw)) return [];
  const out: IngredientItem[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && typeof (entry as { name?: unknown }).name === 'string') {
      const e = entry as { name: string; quantity?: unknown; unit?: unknown };
      out.push({
        name: e.name,
        quantity: typeof e.quantity === 'string' ? e.quantity : null,
        unit: typeof e.unit === 'string' ? e.unit : null,
      });
    }
  }
  return out;
}

function asStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
}

/**
 * Normalise whatever is on `CookingJourney.ingredientStatus` into a v2
 * `IngredientCheckState`. Handles three inputs:
 *  - null / not an object          → null (no ingredient check started)
 *  - legacy `{ have: string[], need: string[] }` (Phase 1)  → a "reconciled,
 *    skipped-detail" v2 state that still restores the comparison
 *  - already v2                    → validated passthrough
 * Pure — the API calls this in `toView`, clients trust the result as-is
 * (never re-derive the comparison from the recipe, brief §34).
 */
export function migrateIngredientCheckState(raw: unknown): IngredientCheckState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.v === 2) {
    const base = emptyIngredientCheckState();
    return {
      ...base,
      subStage: obj.subStage === 'reconciled' ? 'reconciled' : 'reviewScan',
      skipped: obj.skipped === true,
      scannedAt: typeof obj.scannedAt === 'string' ? obj.scannedAt : null,
      detected: asItemArray(obj.detected),
      confirmedNames: asStringArray(obj.confirmedNames),
      manualHave: asItemArray(obj.manualHave),
      haveNames: asStringArray(obj.haveNames),
      need: Array.isArray(obj.need)
        ? obj.need
            .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object' && typeof (n as { name?: unknown }).name === 'string')
            .map((n) => ({ name: n.name as string, note: typeof n.note === 'string' ? n.note : null }))
        : [],
      purchasedNames: asStringArray(obj.purchasedNames),
    };
  }

  // Legacy Phase 1 shape: { have: string[], need: string[] }.
  const legacyHave = asStringArray(obj.have);
  const legacyNeed = asStringArray(obj.need);
  if (legacyHave.length === 0 && legacyNeed.length === 0) return null;
  return {
    ...emptyIngredientCheckState(),
    subStage: 'reconciled',
    skipped: true,
    haveNames: legacyHave,
    need: legacyNeed.map((name) => ({ name, note: null })),
  };
}

/**
 * Merge a fresh scan's detected items into an existing check, honouring the
 * brief's §22 priority: USER CONFIRMED > USER REJECTED > NEW SCAN. A rescan
 * never silently undoes a deliberate decision:
 *  - a name already in `confirmedNames` stays confirmed (kept in `detected`);
 *  - a name the user rejected (was in old `detected`, not in `confirmedNames`)
 *    is NOT re-added to `confirmedNames`, though it reappears in `detected` so
 *    the user can re-confirm it if they want;
 *  - a genuinely new detected name is added as confirmed-by-default (matching
 *    the first-scan behaviour where everything starts selected).
 * Returns the merged `detected` + `confirmedNames`; the caller re-runs the
 * recipe comparison from `confirmedNames` + `manualHave`.
 */
export function reconcileRescan(
  prev: Pick<IngredientCheckState, 'detected' | 'confirmedNames'>,
  newDetected: IngredientItem[],
): { detected: IngredientItem[]; confirmedNames: string[] } {
  const prevRejected = new Set(
    prev.detected.map((d) => d.name).filter((n) => !prev.confirmedNames.includes(n)),
  );
  const prevConfirmed = new Set(prev.confirmedNames);

  // Union of names: everything the previous scan surfaced, plus the new scan.
  const byName = new Map<string, IngredientItem>();
  for (const item of prev.detected) byName.set(item.name, item);
  for (const item of newDetected) byName.set(item.name, item); // new scan wins on qty/unit
  const detected = [...byName.values()];

  const confirmedNames = detected
    .map((d) => d.name)
    .filter((name) => {
      if (prevConfirmed.has(name)) return true; // user confirmed — sticks
      if (prevRejected.has(name)) return false; // user rejected — stays out
      return newDetected.some((d) => d.name === name); // brand new from this scan
    });

  return { detected, confirmedNames };
}

/** Counts for the "Continue where you left off" card (brief §18/§33). */
export function summariseIngredientCheck(state: IngredientCheckState): {
  kept: number;
  rejected: number;
  haveCount: number;
  needCount: number;
  purchasedCount: number;
  detectedCount: number;
} {
  return {
    kept: state.confirmedNames.length,
    rejected: Math.max(0, state.detected.length - state.confirmedNames.length),
    haveCount: state.haveNames.length + state.manualHave.length,
    needCount: state.need.length,
    purchasedCount: state.purchasedNames.length,
    detectedCount: state.detected.length,
  };
}
