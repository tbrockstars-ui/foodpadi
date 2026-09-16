import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Delete your account — FoodPadi' };

// Points at the real, already-built deletion flow (Profile > Privacy ->
// "Delete my account", backed by DELETE /users/me — a genuine hard delete,
// not a soft deactivate) rather than duplicating it here.
const SUPPORT_EMAIL = 'support@foodpadi.app';

export default function DeleteAccountPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={38} className={styles.logo} />
      <h1>Delete your account</h1>
      <p className={styles.body}>
        You can permanently delete your FoodPadi account and everything stored about you at any
        time from <a href="/profile">your Profile</a>, under &ldquo;Privacy&rdquo; →
        &ldquo;Delete my account&rdquo;. This is a real, permanent deletion — not a deactivation —
        and can&apos;t be undone.
      </p>
      <p className={styles.body}>
        Can&apos;t sign in, or need help deleting your account another way? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </main>
  );
}
