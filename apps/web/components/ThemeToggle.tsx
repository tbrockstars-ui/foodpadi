'use client';

import { useTheme } from './useTheme';
import styles from './AppShell.module.css';

/**
 * A compact dark/light toggle for the topbar, for the one context that has
 * no SettingsMenu to hold it: guests. A guest sees Log in / Create account
 * instead of SettingsMenu (no account to manage), so without this there was
 * no way for a guest to switch theme at all — the page silently inherited
 * whatever `foodpadi-theme` was last stored in this browser (e.g. from an
 * earlier signed-in visit), with no visible control to change it back.
 * Members keep using the fuller Black/White switch inside SettingsMenu.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={styles.themeToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'default' : 'dark')}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}
