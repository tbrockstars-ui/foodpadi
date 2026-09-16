import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Privacy — FoodPadi' };

// Structured placeholder, not a finished legal document — every section
// reflects what the product actually does today (see docs/PRIVACY_DATA_MODEL.md
// for the underlying design-time analysis), but the wording itself has not
// been legally reviewed. A legal adviser should replace/confirm the copy in
// each section before this is relied on as a real UK GDPR privacy notice.
export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={38} className={styles.logo} />
      <h1>Privacy</h1>

      <p className={styles.notice}>
        This page describes, in plain language, what FoodPadi actually collects and why. It has{' '}
        <strong>not yet been reviewed by a lawyer</strong> and should not be relied on as a
        finished UK GDPR privacy notice — see{' '}
        <code>docs/PRIVACY_DATA_MODEL.md</code> in the project repository for the fuller
        design-time analysis this page is based on.
      </p>

      <h2>What we collect, and why</h2>
      <ul className={styles.list}>
        <li>
          <strong>Account data</strong> — email, password (hashed, never stored in plain text) or
          Google sign-in, display name, country. Needed to run your account.
        </li>
        <li>
          <strong>Guest data</strong> — a short-lived, anonymous session token if you try FoodPadi
          without an account. Nothing you say as a guest is saved once the session ends.
        </li>
        <li>
          <strong>Food preferences &amp; goals</strong> — cuisines you like, ingredients you&apos;d
          rather avoid, and any goals you choose to set. We ask what you&apos;d like to avoid, not
          why — FoodPadi does not ask about medical conditions or allergies.
        </li>
        <li>
          <strong>Saved recipes, cooking history &amp; plans</strong> — recipes you save, meals
          you&apos;ve cooked, and any meal plans or shopping lists you create, so FoodPadi can be
          useful across visits.
        </li>
        <li>
          <strong>Location</strong> — only requested when you use &ldquo;Find Nearby&rdquo;, used
          for that search, and never tracked continuously in the background.
        </li>
        <li>
          <strong>Usage/analytics events</strong> — which features you use (e.g. a recipe was
          opened, cooking was completed), stored as structured events, not free-text content.
        </li>
        <li>
          <strong>Waitlist signups</strong> — an email address, and, only if you tick the box,
          whether you agreed to receive marketing email and the exact wording you agreed to.
        </li>
        <li>
          <strong>Marketing consent</strong> — kept as a separate record from any account or
          waitlist signup. Using FoodPadi, creating an account, or joining a waitlist never implies
          marketing consent on its own.
        </li>
        <li>
          <strong>Referral data</strong> — if you invite someone or arrive via an invite link, a
          referral code and rough attribution (who invited whom), not stored alongside message
          content.
        </li>
        <li>
          <strong>Notification preferences</strong> — the meal times you&apos;d like to be
          reminded about. Reminders are scheduled and fire locally on your own device; times are
          not treated as precise location or activity tracking.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul className={styles.list}>
        <li>We don&apos;t ask for or attempt to infer medical conditions, allergies, pregnancy, religion, or other sensitive characteristics.</li>
        <li>We don&apos;t sell personal data, and don&apos;t share it with third parties beyond what&apos;s operationally necessary to run the service (e.g. a payment processor).</li>
        <li>We don&apos;t track precise location in the background.</li>
        <li>We don&apos;t treat any signup (account, waitlist, app download) as marketing consent by itself.</li>
      </ul>

      <h2>Your rights</h2>
      <p className={styles.body}>
        You can view, edit, export, or delete your account and food data at any time from{' '}
        <a href="/profile">your Profile</a>. If you can&apos;t sign in, or have a question about
        your data, contact us via our <a href="/legal/contact">contact page</a>.
      </p>

      <h2>Cookies</h2>
      <p className={styles.body}>
        See our <a href="/legal/cookies">Cookie Policy</a> for what we store in your browser and
        why.
      </p>
    </main>
  );
}
