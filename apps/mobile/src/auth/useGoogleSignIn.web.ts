// Web build (Expo web export → Railway) stub. Metro resolves this in place of
// useGoogleSignIn.ts when bundling for web.
//
// The native hook calls `expo-auth-session/providers/google`'s useAuthRequest,
// which throws synchronously on web when no `webClientId` is configured
// ("Client Id property `webClientId` must be defined…") — and because that
// throw happens during render it blanks the whole app. The web export is only
// a browser preview of the RN app, not a real auth surface (the web *app*
// under apps/web has its own Google button), so here Google sign-in is simply
// unavailable and the button never renders.

interface GoogleSignIn {
  signIn: () => void;
  busy: boolean;
  available: boolean;
  isExpoGo: boolean;
}

export function useGoogleSignIn(_onError: (message: string) => void): GoogleSignIn {
  return {
    signIn: () => {},
    busy: false,
    available: false,
    isExpoGo: false,
  };
}
