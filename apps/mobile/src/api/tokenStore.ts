import * as SecureStore from 'expo-secure-store';

// Tokens live in the OS keychain/keystore via expo-secure-store, not
// AsyncStorage — session credentials are exactly the kind of thing
// docs/SECURITY_MODEL.md calls out as needing "secure session handling".
const ACCESS_TOKEN_KEY = 'foodpadi.accessToken';
const REFRESH_TOKEN_KEY = 'foodpadi.refreshToken';

export const tokenStore = {
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
