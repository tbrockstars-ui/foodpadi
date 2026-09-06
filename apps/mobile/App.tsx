import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { enableFreeze, enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { GuestSessionProvider } from './src/auth/GuestSessionContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Native-backed screen containers (default in RN Screens v4, set explicitly
// for intent) + freeze: an inactive screen in a stack/tab — a backgrounded
// tab, a screen pushed under another — stops re-rendering entirely until it's
// focused again. This app has a 4-tab bar plus deep push stacks and several
// screens that refetch in useFocusEffect, so freezing cuts a lot of wasted
// render work on the JS thread. react-navigation's focus effects re-run on
// refocus, so nothing shows stale.
enableScreens(true);
enableFreeze(true);

// Hold the native splash (apps/mobile/assets/splash.png — the black/leaves
// screen) until React has mounted, so a real build shows it with no white
// flash before RootNavigator's matching BrandLoadingScreen takes over.
SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <GuestSessionProvider>
            <ThemedStatusBar />
            <RootNavigator />
          </GuestSessionProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
