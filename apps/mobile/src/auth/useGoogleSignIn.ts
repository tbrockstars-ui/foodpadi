import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from './AuthContext';

// Lets the redirect that lands back in the app finish an in-flight auth
// session (no-op when there isn't one). Safe to call at module scope.
WebBrowser.maybeCompleteAuthSession();

const cfg = (Constants.expoConfig?.extra?.googleAuth ?? {}) as {
  webClientId?: string;
  androidClientId?: string;
  iosClientId?: string;
};

// Google's browser flow redirects to a per-app URL scheme ("foodpadi://"),
// which only exists in a dev/standalone build. In Expo Go the redirect would
// be an exp:// URL that Google rejects, so the button is hidden there.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// The client id the OAuth request will actually use on this platform — the
// button is pointless if the matching one hasn't been configured yet.
const platformClientId =
  Platform.OS === 'ios' ? cfg.iosClientId : Platform.OS === 'android' ? cfg.androidClientId : cfg.webClientId;

interface GoogleSignIn {
  /** Opens the Google account chooser; resolves via loginWithGoogle on success. */
  signIn: () => void;
  /** Waiting on Google / the token exchange. */
  busy: boolean;
  /** Whether to show the button at all (false in Expo Go or if unconfigured). */
  available: boolean;
  /** True when hidden only because the app is running inside Expo Go. */
  isExpoGo: boolean;
}

/**
 * "Continue with Google" for the mobile auth screen. Mirrors the web
 * GoogleSignInButton: runs Google's OAuth flow, then hands the resulting ID
 * token to AuthContext.loginWithGoogle, which posts it to /auth/google.
 */
export function useGoogleSignIn(onError: (message: string) => void): GoogleSignIn {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: cfg.webClientId,
    androidClientId: cfg.androidClientId,
    iosClientId: cfg.iosClientId || undefined,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken =
        (response.params?.id_token as string | undefined) ?? response.authentication?.idToken;
      if (!idToken) {
        setBusy(false);
        onError('Google sign-in did not return a token. Please try again.');
        return;
      }
      loginWithGoogle(idToken)
        .catch(() => onError('Google sign-in failed. Please try again.'))
        .finally(() => setBusy(false));
      return;
    }

    // 'error', 'cancel', 'dismiss', 'locked' — nothing to surface for a
    // deliberate cancel; show the message for an actual error.
    setBusy(false);
    if (response.type === 'error') {
      onError(response.error?.message ?? 'Google sign-in failed. Please try again.');
    }
  }, [response, loginWithGoogle, onError]);

  const signIn = useCallback(() => {
    if (busy || !request) return;
    setBusy(true);
    void promptAsync();
  }, [busy, request, promptAsync]);

  const available = !isExpoGo && !!request && Boolean(platformClientId);

  return { signIn, busy, available, isExpoGo };
}
