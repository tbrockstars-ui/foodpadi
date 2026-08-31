'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'default' | 'dark';

const STORAGE_KEY = 'foodpadi-theme';

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

/**
 * Reads/writes the user's light ("default") / dark theme choice. The value is
 * persisted to localStorage and reflected as `data-theme="dark"` on <html>
 * (globals.css swaps the colour tokens under that selector). The no-flash
 * script in layout.tsx applies the same thing before React hydrates, so this
 * hook only has to keep the toggle UI in sync and handle changes.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>('default');

  useEffect(() => {
    try {
      setThemeState(localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'default');
    } catch {
      /* private mode / storage blocked — stay on default */
    }
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { theme, setTheme };
}
