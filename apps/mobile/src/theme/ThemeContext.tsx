import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colorsFor, type ThemeColors, type ThemeScheme } from './colors';

const STORAGE_KEY = 'foodpadi.theme';
const isWeb = Platform.OS === 'web';

async function readStored(): Promise<ThemeScheme | null> {
  try {
    const v = isWeb ? localStorage.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    return v === 'dark' || v === 'default' ? v : null;
  } catch {
    return null;
  }
}

async function writeStored(scheme: ThemeScheme): Promise<void> {
  try {
    if (isWeb) localStorage.setItem(STORAGE_KEY, scheme);
    else await SecureStore.setItemAsync(STORAGE_KEY, scheme);
  } catch {
    /* ignore */
  }
}

interface ThemeContextValue {
  scheme: ThemeScheme;
  colors: ThemeColors;
  setScheme: (scheme: ThemeScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Light ("default") / dark theme choice for the mobile app — mirrors the
 * web settings menu. The value is persisted (SecureStore, localStorage on
 * web) and exposed as `colors`. Screens/components read it via useTheme();
 * anything still importing the static `colors` export stays light until
 * migrated.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ThemeScheme>('default');

  useEffect(() => {
    readStored().then((s) => {
      if (s) setSchemeState(s);
    });
  }, []);

  const setScheme = useCallback((next: ThemeScheme) => {
    setSchemeState(next);
    void writeStored(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: colorsFor(scheme), setScheme }),
    [scheme, setScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
