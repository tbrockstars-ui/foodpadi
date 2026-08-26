'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/Button';
import styles from '../auth.module.css';

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordLongEnough = password.length >= 8;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Validate on submit rather than gating the button on live state — see
    // the matching comment in app/login/page.tsx.
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail) || password.length < 8) {
      setError('Enter a valid email and a password of at least 8 characters.');
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
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password.length > 0 && !passwordLongEnough ? <p className={styles.hint}>At least 8 characters</p> : null}
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
