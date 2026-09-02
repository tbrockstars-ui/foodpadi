import { DISCLAIMER_TEXT } from '@foodpadi/shared';
import { Logo } from '../../../components/Logo';
import styles from '../legal.module.css';

export const metadata = { title: 'Food & Safety Information — FoodPadi' };

export default function DisclaimerPage() {
  return (
    <main className={styles.main}>
      <Logo href="/" size={32} className={styles.logo} />
      <h1>Food & safety information</h1>
      <p className={styles.body} style={{ whiteSpace: 'pre-line' }}>
        {DISCLAIMER_TEXT}
      </p>
    </main>
  );
}
