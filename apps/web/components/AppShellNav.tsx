'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AppShell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: (props: { width: number; height: number }) => JSX.Element;
  membersOnly?: boolean;
  /** Extra path prefixes that should also count as "active" for this item
      (e.g. guest Home lives at /guest, not /). */
  alsoMatch?: string[];
}

// Ordered so a more specific route (e.g. /cook-today/saved) is checked before
// a broader one that would otherwise also match (/cook-today) — see isActive.
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon, alsoMatch: ['/guest'] },
  { href: '/cook-today', label: 'Cook', icon: CookIcon },
  { href: '/plan', label: 'Plan', icon: PlanIcon },
  { href: '/eat-now', label: 'Discover', icon: DiscoverIcon },
  { href: '/favorites', label: 'Favorites', icon: SavedIcon, membersOnly: true },
  { href: '/profile', label: 'Profile', icon: ProfileIcon, membersOnly: true },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/') return pathname === '/' || (item.alsoMatch ?? []).includes(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Persistent left sidebar for the main app (mirrors AdminSidebarNav's
 * active-link pattern). Rendered inside AppShell, which supplies the
 * surrounding shell/topbar chrome — this component owns only the nav list.
 */
export function AppShellNav({ guest }: { guest: boolean }) {
  const pathname = usePathname();
  // "Cook Today saved" is a more specific match than "Cook Today" itself —
  // check it first so /cook-today/saved highlights Saved, not Cook.
  const items = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);
  const activeHref = items.find((item) => isActive(pathname, item))?.href;

  return (
    <nav className={styles.sidebarNav} aria-label="Main">
      {NAV_ITEMS.filter((item) => !guest || !item.membersOnly).map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon width={18} height={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function iconProps(width: number, height: number) {
  return {
    width,
    height,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    'aria-hidden': true as const,
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function HomeIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg {...iconProps(width, height)}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function CookIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg {...iconProps(width, height)}>
      <path d="M4 8.5c0-2.5 3.5-4.5 8-4.5s8 2 8 4.5" />
      <path d="M3.5 8.5h17M5 8.5l1 9a2 2 0 0 0 2 1.8h8a2 2 0 0 0 2-1.8l1-9" />
    </svg>
  );
}

function PlanIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg {...iconProps(width, height)}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

function DiscoverIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg {...iconProps(width, height)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function SavedIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg {...iconProps(width, height)}>
      <path d="M6 4.5h12v15l-6-4-6 4v-15Z" />
    </svg>
  );
}

function ProfileIcon({ width, height }: { width: number; height: number }) {
  return (
    <svg {...iconProps(width, height)}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c0-3.6 3.35-6.5 7.5-6.5s7.5 2.9 7.5 6.5" />
    </svg>
  );
}
