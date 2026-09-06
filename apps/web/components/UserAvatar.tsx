import Link from 'next/link';
import styles from './AppShell.module.css';

function initialsFrom(displayName: string | null, email: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase();
  }
  return (email[0] ?? '?').toUpperCase();
}

/**
 * Circular initials badge for the topbar (screenshot's avatar-next-to-Settings
 * pairing). Links straight to /profile rather than opening its own dropdown —
 * SettingsMenu already covers the account menu, so this is a quick-access
 * shortcut, not a second copy of that menu.
 */
export function UserAvatar({ displayName, email }: { displayName: string | null; email: string }) {
  return (
    <Link href="/profile" className={styles.avatar} aria-label="Your profile" title="Your profile">
      {initialsFrom(displayName, email)}
    </Link>
  );
}
