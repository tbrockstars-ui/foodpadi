'use client';

import { useEffect, useRef, useState } from 'react';

// Minimal shape of the bits of Google Identity Services we use.
interface GoogleIdApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (res: { credential?: string }) => void;
        auto_select?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: { theme?: string; size?: string; text?: string; shape?: string; width?: number; logo_alignment?: string },
      ) => void;
    };
  };
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function loadGsi(): Promise<GoogleIdApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const existing = (window as unknown as { google?: GoogleIdApi }).google;
  if (existing?.accounts?.id) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const done = () => resolve((window as unknown as { google?: GoogleIdApi }).google ?? null);
    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    // Already cached / loaded between the check above and here.
    if ((window as unknown as { google?: GoogleIdApi }).google?.accounts?.id) done();
  });
}

interface Props {
  /** Where to send the user after a successful sign-in. */
  next: string;
  /** Button copy — matches the surrounding form's intent. */
  text?: 'signup_with' | 'continue_with' | 'signin_with';
  onError: (message: string) => void;
}

/**
 * "Continue with Google" — renders Google's own button (Google Identity
 * Services). On success it posts the returned ID token to /api/auth/google,
 * which sets the session cookies, then does a full navigation to `next`
 * (same pattern as the email/password forms). Renders nothing when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't configured, so it's safe to ship before
 * the OAuth client exists.
 */
export function GoogleSignInButton({ next, text = 'continue_with', onError }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !holder.current) return;
    let cancelled = false;

    void loadGsi().then((google) => {
      if (cancelled || !google || !holder.current) {
        if (!google) onError('Could not load Google sign-in. Check your connection and try again.');
        return;
      }
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (res) => {
          if (!res.credential) {
            onError('Google sign-in was cancelled.');
            return;
          }
          setBusy(true);
          try {
            const apiRes = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: res.credential }),
            });
            if (!apiRes.ok) {
              const data = (await apiRes.json().catch(() => ({}))) as { message?: string | string[] };
              const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
              throw new Error(message ?? 'Google sign-in failed. Please try again.');
            }
            window.location.href = next;
          } catch (err) {
            setBusy(false);
            onError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
          }
        },
      });
      const width = Math.min(holder.current.clientWidth || 320, 400);
      google.accounts.id.renderButton(holder.current, {
        theme: 'outline',
        size: 'large',
        text,
        shape: 'pill',
        width,
        logo_alignment: 'center',
      });
    });

    return () => {
      cancelled = true;
    };
  }, [next, text, onError]);

  if (!CLIENT_ID) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
      <div ref={holder} />
    </div>
  );
}
