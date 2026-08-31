'use client';

import { useState } from 'react';
import styles from '../admin.module.css';

/**
 * The admin login form itself stays a plain server-rendered <form
 * action="/api/admin/login"> (no JS required to sign in) — this is the one
 * bit of it that needs client interactivity, so it's split out rather than
 * converting the whole page to a client component.
 */
export function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.passwordWrap}>
      <input
        type={visible ? 'text' : 'password'}
        name="password"
        placeholder="Password"
        required
        className={styles.input}
        autoComplete="current-password"
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 5.2C11 5.07 11.5 5 12 5c7 0 10.5 7 10.5 7-.6 1.2-1.6 2.66-3 3.9M6.5 6.6C3.4 8.5 1.5 12 1.5 12S5 19 12 19c1.4 0 2.6-.28 3.7-.75M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
