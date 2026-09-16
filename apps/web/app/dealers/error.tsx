'use client';

import { useEffect } from 'react';

/**
 * Segment error boundary for the whole /dealers/* section (dashboard,
 * onboarding, the public listing page). Next.js renders this in place of the
 * page whenever a Server Component under this segment throws — the safety
 * net for the handful of dealer pages that only special-case a couple of
 * ApiError statuses (404/401) and otherwise rethrow, e.g. when the API is
 * briefly unreachable ("fetch failed": a restart, a cold start, a DNS/IPv6
 * blip). Without this, that rethrow was an unhandled runtime error / blank
 * page (see apps/web/app/dealers/dashboard/layout.tsx's own comment for the
 * more specific fix applied to the main dashboard entry).
 *
 * `reset()` re-renders the segment in place — the same "Try again" affordance
 * used elsewhere in the app (profile/favorites/invite/shopping-list), just
 * via Next's own retry mechanism instead of a link-triggered navigation.
 */
export default function DealersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[dealers] segment error:', error);
  }, [error]);

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ color: 'var(--danger)', marginBottom: 16 }}>
        Couldn&apos;t load this page. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          textDecoration: 'underline',
          background: 'none',
          border: 'none',
          font: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </main>
  );
}
