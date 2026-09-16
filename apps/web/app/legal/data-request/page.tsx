import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Request your data — FoodPadi' };

// Points at the real, already-built export flow (Profile > Privacy ->
// "Export my data", backed by GET /users/me/export) rather than duplicating
// it here, plus a route for anyone who can't sign in.
const SUPPORT_EMAIL = 'support@foodpadi.app';

export default function DataRequestPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={38} className={styles.logo} />
      <h1>Request your data</h1>
      <p className={styles.body}>
        If you have a FoodPadi account, you can export everything we hold about you at any time
        from <a href="/profile">your Profile</a>, under &ldquo;Privacy&rdquo; →
        &ldquo;Export my data&rdquo;.
      </p>
      <p className={styles.body}>
        If you can&apos;t sign in, or have a question about what data we hold, correcting it, or
        who it&apos;s shared with, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll respond directly.
      </p>
      <p className={styles.body}>
        See our <a href="/legal/privacy">Privacy</a> page for what we collect and why.
      </p>
    </main>
  );
}
