'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import styles from '../auth.module.css';

// Open-eye / eye-with-slash, swapped based on showPassword — the icon
// depicts the field's current state (open eye = currently visible), the
// usual convention for a password-visibility toggle.
function EyeIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Web counterpart to apps/mobile/src/screens/AuthScreen.tsx's register mode. */
export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordLongEnough = password.length >= 8;
  const passwordsMatch = confirmPassword.length === 0 || confirmPassword === password;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Validate on submit rather than gating the button on live state — see
    // the matching comment in app/login/page.tsx.
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail) || password.length < 8) {
      setError('Enter a valid email and a password of at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(data.message) ? data.message.join('. ') : data.message;
        throw new Error(message ?? 'Something went wrong. Please try again.');
      }
      // Full navigation, not router.push()+refresh() — see the matching
      // comment in app/login/page.tsx.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brandStage}>
          <Logo withWordmark={false} size={84} className={styles.brandBadge} />
        </div>
        <h1 className={styles.title}>FoodPadi</h1>
        <p className={styles.subtitle}>Your food companion that plans with you, not for you.</p>

        <form onSubmit={submit}>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((s) => !s)}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          {password.length > 0 && !passwordLongEnough ? <p className={styles.hint}>At least 8 characters</p> : null}

          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-pressed={showConfirm}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              onClick={() => setShowConfirm((s) => !s)}
            >
              <EyeIcon off={showConfirm} />
            </button>
          </div>
          {!passwordsMatch ? <p className={styles.hint}>Passwords don&apos;t match</p> : null}

          {error ? <p className={styles.error}>{error}</p> : null}

          <Button type="submit" loading={submitting} className={styles.primaryButton}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <Link className={styles.switchModeText} href={next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'}>
          Already have an account? Log in
        </Link>
      </div>
    </main>
  );
}
