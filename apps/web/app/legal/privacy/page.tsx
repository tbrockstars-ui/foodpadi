import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Privacy — FoodPadi' };

export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={32} className={styles.logo} />
      <h1>Privacy</h1>
      <p className={styles.body}>
        FoodPadi collects only what it needs to run the app: your account details, the food
        preferences and goals you choose to share, and how you use the app&apos;s features. We do
        not ask why you avoid a food — only what you&apos;d like to avoid. You can view, edit,
        export, or delete your food profile and AI memory at any time from the app&apos;s Settings.
      </p>
      <p className={styles.body}>
        A full privacy notice, written and reviewed for UK GDPR compliance, will replace this
        placeholder before launch — see{' '}
        <code>docs/PRIVACY_DATA_MODEL.md</code> in the project repository for the design-time
        analysis this page will be based on.
      </p>
    </main>
  );
}
