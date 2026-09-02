'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '../components/useTheme';
import styles from './settings.module.css';

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.gearIcon}>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H11a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V11a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Settings menu in the home top bar (upper-right, opposite the logo). Tucks
 * the account links, a light/dark theme toggle, and read-only subscription /
 * payment placeholders behind one gear button so the header stays clean.
 * Mobile counterpart: apps/mobile/src/screens/SettingsScreen.tsx.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        <GearIcon />
        <span className={styles.triggerLabel}>Settings</span>
      </button>

      {open ? (
        <div className={styles.panel} id={panelId} role="menu">
          <p className={styles.sectionLabel}>Account</p>
          <Link href="/profile" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Profile
          </Link>
          <Link href="/profile#avoided-foods" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Foods to avoid
          </Link>
          <Link href="/cook-today/saved" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Saved recipes
          </Link>
          <Link href="/plan/saved" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Saved plans
          </Link>
          <Link href="/invite" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Invite a friend
          </Link>

          <div className={styles.divider} />

          <p className={styles.sectionLabel}>Appearance</p>
          <div className={styles.segmented} role="group" aria-label="Theme">
            <button
              type="button"
              className={`${styles.segment} ${theme === 'dark' ? styles.segmentActive : ''}`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              Black
            </button>
            <button
              type="button"
              className={`${styles.segment} ${theme === 'default' ? styles.segmentActive : ''}`}
              aria-pressed={theme === 'default'}
              onClick={() => setTheme('default')}
            >
              White
            </button>
          </div>

          <div className={styles.divider} />

          <p className={styles.sectionLabel}>Subscription</p>
          <div className={styles.infoRow}>
            <span className={styles.infoKey}>Plan</span>
            <span className={styles.planBadge}>Free</span>
          </div>
          <p className={styles.muted}>You&apos;re on the free plan. Paid plans aren&apos;t available yet.</p>

          <p className={styles.sectionLabel}>Payment history</p>
          <p className={styles.muted}>No payments yet.</p>

          <div className={styles.divider} />

          <form action="/api/auth/logout" method="POST">
            <button type="submit" className={`${styles.item} ${styles.danger}`} role="menuitem">
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
