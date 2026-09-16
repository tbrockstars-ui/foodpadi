import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Terms — FoodPadi' };

// Placeholder structure only — section headings a legal adviser should fill
// in or confirm before launch. No terms are asserted here as binding.
export default function TermsPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={38} className={styles.logo} />
      <h1>Terms of Service</h1>

      <p className={styles.notice}>
        This page is a placeholder structure, not a finished, legally reviewed Terms of Service.
        Each section below needs real wording from a legal adviser before FoodPadi relies on it.
      </p>

      <h2>What FoodPadi is</h2>
      <p className={styles.body}>
        FoodPadi is a food decision assistant — it helps you decide what to eat, cook with what
        you have, and find food nearby. It is not a food delivery service, a medical or
        nutrition-advice service, or a marketplace. See our{' '}
        <a href="/legal/disclaimer">food &amp; safety information</a> for what FoodPadi does and
        doesn&apos;t claim.
      </p>

      <h2>Using the service</h2>
      <p className={styles.body}>
        [Placeholder — eligibility, acceptable use, account responsibilities, and what happens if
        the service is misused. To be confirmed by a legal adviser.]
      </p>

      <h2>Guest access</h2>
      <p className={styles.body}>
        [Placeholder — guest sessions are anonymous and time-limited; no account is required to
        try the core decision experience.]
      </p>

      <h2>Subscriptions &amp; payments</h2>
      <p className={styles.body}>
        [Placeholder — where FoodPadi offers a paid subscription, terms covering billing, renewal,
        and cancellation will be confirmed here.]
      </p>

      <h2>Content &amp; recommendations</h2>
      <p className={styles.body}>
        [Placeholder — FoodPadi provides food information and suggestions, not professional
        medical or nutrition advice. See the disclaimer above.]
      </p>

      <h2>Changes to these terms</h2>
      <p className={styles.body}>
        [Placeholder — how and when these terms may be updated, and how you&apos;ll be notified.]
      </p>

      <h2>Contact</h2>
      <p className={styles.body}>
        Questions about these terms — see our <a href="/legal/contact">contact page</a>.
      </p>
    </main>
  );
}
