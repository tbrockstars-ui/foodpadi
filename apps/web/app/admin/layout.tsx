import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '../../lib/adminSession';
import { AdminSidebarNav } from './AdminSidebarNav';
import { Logo } from '../../components/Logo';
import styles from './admin.module.css';

/**
 * Shared chrome (sidebar + topbar) for every /admin/* route. Deliberately
 * does NOT call requireAdminSession() / redirect() itself — that would also
 * fire for /admin/login (a child route of this layout) and break signing in.
 * Instead: no valid session → render children bare, which is exactly what
 * /admin/login needs (a plain centred card, no dashboard chrome); each
 * dashboard page still calls requireAdminSession() itself as before, so the
 * redirect-when-signed-out behaviour is unchanged.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  const staff = verifyAdminSessionToken(token);

  if (!staff) {
    return <>{children}</>;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <Logo withWordmark={false} size={28} />
          <span>FoodPadi admin</span>
        </div>
        <AdminSidebarNav />
      </aside>

      <div className={styles.shellMain}>
        <header className={styles.topbar}>
          <span className={styles.topbarStaff}>Signed in as {staff.displayName ?? staff.username}</span>
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className={styles.linkButton}>
              Sign out
            </button>
          </form>
        </header>
        <div className={styles.shellContent}>{children}</div>
      </div>
    </div>
  );
}
