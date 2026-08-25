import Link from 'next/link';
import styles from './page.module.css';

// Placeholder store links — swap for real App Store/Play Store URLs once listed.
const APP_STORE_URL = '#';
const PLAY_STORE_URL = '#';

export default function LandingPage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className={styles.title}>FoodPadi</h1>
        <p className={styles.tagline}>Your food companion that plans with you, not for you.</p>
        <p className={styles.subtext}>
          Eat Now, Cook Today, or Plan Ahead — FoodPadi adapts to real life instead of asking you
          to plan your life around a meal plan.
        </p>

        <div className={styles.storeLinks}>
          <a className={styles.storeButton} href={APP_STORE_URL}>
            Download on the App Store
          </a>
          <a className={styles.storeButton} href={PLAY_STORE_URL}>
            Get it on Google Play
          </a>
        </div>
      </section>

      <section className={styles.modes}>
        <div className={styles.modeCard}>
          <h2>Eat Now</h2>
          <p>I&apos;m hungry. What can I eat right now?</p>
        </div>
        <div className={styles.modeCard}>
          <h2>Cook Today</h2>
          <p>What can I cook with what I&apos;ve got?</p>
        </div>
        <div className={styles.modeCard}>
          <h2>Plan Ahead</h2>
          <p>Help me plan my meals — flexibly.</p>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/legal/disclaimer">Food & safety information</Link>
        <span className={styles.footerDivider}>·</span>
        <Link href="/legal/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
