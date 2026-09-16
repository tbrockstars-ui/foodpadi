import type { ClientEventMetadata, ClientEventType } from '@foodpadi/shared';

// Fire-and-forget client-only analytics — the handful of Cook Today funnel
// steps with no natural backend request of their own to piggyback on (see
// apps/api/src/modules/analytics/dto/track-client-event.dto.ts for the full
// allowlist and why it's closed rather than free-form). Never awaited by
// callers and never throws: a dropped analytics call must not affect the
// actual product experience (§28 — Companion/analytics is an enhancement,
// not a dependency).
export function trackClientEvent(eventType: ClientEventType, metadata?: ClientEventMetadata): void {
  fetch('/api/proxy/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, metadata }),
  }).catch(() => undefined);
}
