import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Contact — FoodPadi' };

// Placeholder support address — swap for the real inbox once set up (mirrors
// the same SUPPORT_EMAIL note in app/page.tsx).
const SUPPORT_EMAIL = 'support@foodpadi.app';

export default function ContactPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={38} className={styles.logo} />
      <h1>Contact</h1>
      <p className={styles.body}>
        Questions, feedback, or a problem with your account — email us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll get back to you.
      </p>
      <p className={styles.body}>
        For privacy questions or a request about your data specifically, see our{' '}
        <a href="/legal/data-request">data request</a> page.
      </p>
    </main>
  );
}
