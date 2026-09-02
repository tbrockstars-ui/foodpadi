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
 * Reads/writes the user's dark (black, the default) / "default" (white)
 * theme choice. The value is persisted to localStorage and reflected as
 * `data-theme="dark"` on <html> (globals.css swaps the colour tokens under
 * that selector). The no-flash script in layout.tsx applies the same thing
 * before React hydrates, so this hook only has to keep the toggle UI in
 * sync and handle changes. Anything other than an explicit, previously
 * saved `'default'` (white) falls back to dark — new users, private-mode
 * visitors with storage blocked, and anyone who'd previously chosen dark
 * all land on black.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>('dark');

  useEffect(() => {
    try {
      setThemeState(localStorage.getItem(STORAGE_KEY) === 'default' ? 'default' : 'dark');
    } catch {
      /* private mode / storage blocked — stay on the black default */
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
