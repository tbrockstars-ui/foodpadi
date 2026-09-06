import type { LocalFoodSearchInteractionType } from '@foodpadi/shared';

// "Find Near Me" brief §16 — client-only interactions the server can't
// otherwise observe (a permission prompt's outcome, tapping a maps/order
// link). Fire-and-forget through the existing generic proxy
// (apps/web/app/api/proxy/[...path]/route.ts) — same posture as the search
// call itself; a broken analytics ping must never surface to the user or
// block the flow, so failures are swallowed here.
export function trackLocalFoodSearchInteraction(
  interactionType: LocalFoodSearchInteractionType,
  metadata?: Record<string, unknown>,
): void {
  fetch('/api/proxy/local-food-search/interaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interactionType, metadata }),
  }).catch(() => undefined);
}
