'use client';

import { useState } from 'react';

/**
 * Starts a guest session (POST /api/guest/start) and lands the visitor on
 * /guest, the dedicated guest entry point (guest HomeHub — DecideFlow etc.)
 * — used as both the nav's and the hero's "Try FoodPadi" CTA so the two
 * stay in sync rather than drifting into two separate implementations.
 *
 * The navigation fires immediately on click rather than waiting for the
 * guest-start request to finish first — that serialized "wait, then go" was
 * the slow part, not the request itself. The POST still runs, just in the
 * background: it usually beats the page transition to /guest anyway (same
 * localhost/short hop), and on the rare case it doesn't, /guest's own
 * GuestAutoStart starts the session itself as the fallback — so this is
 * never actually broken, just faster in the common case.
 */
export function TryFoodPadiButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [starting, setStarting] = useState(false);

  const tryAsGuest = () => {
    setStarting(true);
    void fetch('/api/guest/start', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/guest';
  };

  return (
    <button type="button" className={className} onClick={tryAsGuest} disabled={starting}>
      {starting ? "Let's Eat!" : children}
    </button>
  );
}
