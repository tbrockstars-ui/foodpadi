import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from '../../../lib/adminSession';
import styles from '../admin.module.css';
import { PasswordField } from './PasswordField';

export const metadata = { title: 'Admin sign in — FoodPadi' };

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Already signed in (e.g. navigated back here manually) — go straight to
  // the dashboard instead of showing a redundant sign-in form under the
  // dashboard chrome.
  if (isValidAdminSessionToken(cookies().get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin');
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.heading}>FoodPadi admin</h1>
        <p className={styles.subtext}>Staff access only.</p>
        {searchParams.error ? <p className={styles.error}>Incorrect username or password.</p> : null}
        <form action="/api/admin/login" method="POST" className={styles.form}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            required
            className={styles.input}
            autoFocus
            autoComplete="username"
          />
          <PasswordField />
          <button type="submit" className={styles.button}>
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
