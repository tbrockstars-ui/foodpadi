import styles from '../admin.module.css';

export const metadata = { title: 'Admin sign in — FoodPadi' };

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.heading}>FoodPadi admin</h1>
        <p className={styles.subtext}>Staff access only.</p>
        {searchParams.error ? <p className={styles.error}>Incorrect access code.</p> : null}
        <form action="/api/admin/login" method="POST" className={styles.form}>
          <input
            type="password"
            name="accessCode"
            placeholder="Access code"
            required
            className={styles.input}
            autoFocus
          />
          <button type="submit" className={styles.button}>
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
