import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Tokens live in the OS keychain/keystore via expo-secure-store, not
// AsyncStorage — session credentials are exactly the kind of thing
// docs/SECURITY_MODEL.md calls out as needing "secure session handling".
//
// expo-secure-store has no web implementation (it throws), so web falls
// back to localStorage. That fallback is NOT secure storage — it's only used
// when this mobile codebase itself is compiled to run in a browser (`expo
// start --web`), which stays a dev/preview convenience for testing the
// mobile app, not a real deployment target. It is unrelated to apps/web's
// separate customer-facing Next.js app (docs/TECHNICAL_ARCHITECTURE.md
// §2.7), which uses proper per-user httpOnly session cookies instead.
const ACCESS_TOKEN_KEY = 'foodpadi.accessToken';
const REFRESH_TOKEN_KEY = 'foodpadi.refreshToken';
const GUEST_TOKEN_KEY = 'foodpadi.guestToken';
const GUEST_DISCLAIMER_KEY = 'foodpadi.guestDisclaimerAcknowledged';
const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  return isWeb ? localStorage.getItem(key) : SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  getAccessToken: () => getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => getItem(REFRESH_TOKEN_KEY),
  async setTokens(accessToken: string, refreshToken: string) {
    await setItem(ACCESS_TOKEN_KEY, accessToken);
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  async clear() {
    await removeItem(ACCESS_TOKEN_KEY);
    await removeItem(REFRESH_TOKEN_KEY);
  },
  // Guest session token (docs/FOODPADI_AUTHENTICATION_SPEC.md) — not
  // sensitive in the same way (no password, no persisted preferences behind
  // it), but reuses the same storage so it survives an app restart within
  // its own short TTL.
  getGuestToken: () => getItem(GUEST_TOKEN_KEY),
  setGuestToken: (token: string) => setItem(GUEST_TOKEN_KEY, token),
  clearGuestToken: () => removeItem(GUEST_TOKEN_KEY),
  async getGuestDisclaimerAcknowledged() {
    return (await getItem(GUEST_DISCLAIMER_KEY)) === 'true';
  },
  setGuestDisclaimerAcknowledged: () => setItem(GUEST_DISCLAIMER_KEY, 'true'),
  clearGuestDisclaimerAcknowledged: () => removeItem(GUEST_DISCLAIMER_KEY),
};
