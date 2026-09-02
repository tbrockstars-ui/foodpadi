import { ForbiddenException } from '@nestjs/common';
import type { GuestActor, RequestActor } from '../modules/auth/guest-or-auth.guard';

/**
 * The single place that answers "is this actor allowed to trigger a paid AI
 * call?". A guest never is (docs/AI_SAFETY_POLICY.md + the guest-mode brief:
 * zero Anthropic calls for guests, no exceptions). Guest-reachable AI
 * features must either branch to a deterministic path (Cook Today / Decide →
 * curated-recipes.ts) or call `assertMemberForAi` to turn the guest away
 * with a conversion-friendly 403 (Scan → dish identification).
 *
 * This is enforced server-side and independent of the route guard: even if a
 * route is later loosened back to GuestOrAuthGuard by mistake, the service
 * still refuses.
 */
export function isGuest(actor: RequestActor): actor is GuestActor {
  return actor.type === 'guest';
}

export function assertMemberForAi(actor: RequestActor, feature: string): void {
  if (isGuest(actor)) {
    throw new ForbiddenException(`Create a free FoodPadi account to use ${feature}.`);
  }
}
