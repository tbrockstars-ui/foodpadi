import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { tokenStore } from '../api/tokenStore';

interface GuestSessionContextValue {
  isLoading: boolean;
  hasGuestSession: boolean;
  disclaimerAcknowledged: boolean;
  /** Returns a valid guest token, creating one via the API if none exists yet. */
  ensureSession: () => Promise<string>;
  /** Returns the freshly-acknowledged token — callers that need to act on it
   * immediately (e.g. auto-running a search right after) must use this
   * return value rather than calling ensureSession() again, since that would
   * read from a closure captured before this update and — if the caller's
   * component hasn't re-rendered yet — create and return a second, still-
   * unacknowledged guest session instead of reusing this one. */
  acknowledgeDisclaimer: () => Promise<string>;
  clearSession: () => Promise<void>;
}

const GuestSessionContext = createContext<GuestSessionContextValue | undefined>(undefined);

export function GuestSessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedToken, storedAck] = await Promise.all([
        tokenStore.getGuestToken(),
        tokenStore.getGuestDisclaimerAcknowledged(),
      ]);
      setGuestToken(storedToken);
      setDisclaimerAcknowledged(storedAck);
      setIsLoading(false);
    })();
  }, []);

  const ensureSession = useCallback(async () => {
    if (guestToken) return guestToken;
    const { guestToken: newToken } = await api.createGuestSession();
    await tokenStore.setGuestToken(newToken);
    setGuestToken(newToken);
    return newToken;
  }, [guestToken]);

  const acknowledgeDisclaimer = useCallback(async () => {
    const token = await ensureSession();
    const { guestToken: updatedToken } = await api.acknowledgeGuestDisclaimer(token);
    await tokenStore.setGuestToken(updatedToken);
    await tokenStore.setGuestDisclaimerAcknowledged();
    setGuestToken(updatedToken);
    setDisclaimerAcknowledged(true);
    return updatedToken;
  }, [ensureSession]);

  // Called once a guest converts to a real account — guest state is
  // intentionally ephemeral (docs/FOODPADI_AUTHENTICATION_SPEC.md), there is
  // nothing to migrate, just clear it.
  const clearSession = useCallback(async () => {
    await tokenStore.clearGuestToken();
    await tokenStore.clearGuestDisclaimerAcknowledged();
    setGuestToken(null);
    setDisclaimerAcknowledged(false);
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      hasGuestSession: guestToken !== null,
      disclaimerAcknowledged,
      ensureSession,
      acknowledgeDisclaimer,
      clearSession,
    }),
    [isLoading, guestToken, disclaimerAcknowledged, ensureSession, acknowledgeDisclaimer, clearSession],
  );

  return <GuestSessionContext.Provider value={value}>{children}</GuestSessionContext.Provider>;
}

export function useGuestSession() {
  const ctx = useContext(GuestSessionContext);
  if (!ctx) {
    throw new Error('useGuestSession must be used within a GuestSessionProvider');
  }
  return ctx;
}
