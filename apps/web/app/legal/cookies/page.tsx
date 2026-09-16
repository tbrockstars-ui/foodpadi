import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Cookies — FoodPadi' };

// Describes what the site actually stores today — not a hypothetical policy.
// FoodPadi currently uses no third-party analytics, advertising, or tracking
// scripts of any kind; update this page the moment that changes, alongside
// adding real accept/reject controls to CookieNotice.tsx (today it's a
// simple notice, not a consent manager, because there's nothing non-essential
// to consent to yet).
export default function CookiesPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={38} className={styles.logo} />
      <h1>Cookies &amp; similar technologies</h1>

      <p className={styles.body}>
        FoodPadi currently uses only storage that&apos;s <strong>strictly necessary</strong> to run
        the site — there is no advertising, analytics, or third-party tracking of any kind at this
        time.
      </p>

      <h2>What we store, and why</h2>
      <ul className={styles.list}>
        <li>
          <strong>Session cookies</strong> — keep you signed in, or remember an anonymous guest
          session, so you don&apos;t have to log in on every page.
        </li>
        <li>
          <strong>Theme preference</strong> — stored in your browser&apos;s local storage, so
          FoodPadi remembers your light/dark choice.
        </li>
        <li>
          <strong>Referral code</strong> — if you arrive via an invite link, a short-lived cookie
          remembers who invited you, so credit reaches the right person if you sign up.
        </li>
      </ul>

      <p className={styles.body}>
        None of this is used for advertising, and none of it is shared with third parties for
        marketing purposes. If FoodPadi adds analytics or advertising technology in future, this
        page — and a proper cookie-consent choice — will be updated before that happens.
      </p>

      <h2>Managing cookies</h2>
      <p className={styles.body}>
        You can clear cookies and local storage at any time from your browser&apos;s settings.
        Doing so will sign you out and reset your theme preference.
      </p>
    </main>
  );
}
