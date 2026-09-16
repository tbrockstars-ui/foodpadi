import Link from 'next/link';
import { parseAvatarId } from '@foodpadi/shared';
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
 * Circular badge for the topbar (screenshot's avatar-next-to-Settings
 * pairing). Links straight to /profile rather than opening its own dropdown —
 * SettingsMenu already covers the account menu, so this is a quick-access
 * shortcut, not a second copy of that menu.
 *
 * Shows the user's chosen birth-month icon (user instruction 2026-09-11) when
 * they've picked one; falls back to the original initials badge otherwise —
 * nobody is forced to pick an avatar.
 */
export function UserAvatar({
  displayName,
  email,
  avatarId,
}: {
  displayName: string | null;
  email: string;
  avatarId?: string | null;
}) {
  const avatar = parseAvatarId(avatarId);
  return (
    <Link
      href="/profile"
      className={styles.avatar}
      aria-label="Your profile"
      title="Your profile"
      style={
        avatar
          ? {
              background: `linear-gradient(155deg, ${avatar.colorFrom}, ${avatar.colorTo})`,
              color: avatar.textColor,
              border: 'none',
              fontSize: 18,
            }
          : undefined
      }
    >
      {avatar ? <span aria-hidden>{avatar.emoji}</span> : initialsFrom(displayName, email)}
    </Link>
  );
}
