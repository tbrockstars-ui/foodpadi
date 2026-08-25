import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Tokens live in the OS keychain/keystore via expo-secure-store, not
// AsyncStorage — session credentials are exactly the kind of thing
// docs/SECURITY_MODEL.md calls out as needing "secure session handling".
//
// expo-secure-store has no web implementation (it throws), so web falls
// back to localStorage. That fallback is NOT secure storage — it exists only
// because web is a dev/preview convenience for this product (see
// docs/TECHNICAL_ARCHITECTURE.md §2.7: the mobile app is the only real
// user-facing target), never the production platform this matters for.
const ACCESS_TOKEN_KEY = 'foodpadi.accessToken';
const REFRESH_TOKEN_KEY = 'foodpadi.refreshToken';
const isWeb = Platform.OS === 'web';

export const tokenStore = {
  async getAccessToken() {
    return isWeb ? localStorage.getItem(ACCESS_TOKEN_KEY) : SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return isWeb
      ? localStorage.getItem(REFRESH_TOKEN_KEY)
      : SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken: string, refreshToken: string) {
    if (isWeb) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      return;
    }
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },
  async clear() {
    if (isWeb) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
