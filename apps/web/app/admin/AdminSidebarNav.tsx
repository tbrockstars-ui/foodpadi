'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './admin.module.css';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: OverviewIcon, exact: true },
  { href: '/admin/users', label: 'Users', icon: UsersIcon, exact: false },
  { href: '/admin/waitlist', label: 'Waitlist', icon: WaitlistIcon, exact: false },
  { href: '/admin/food-ideas', label: 'Food ideas', icon: FoodIcon, exact: false },
] as const;

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebarNav} aria-label="Admin sections">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function iconProps() {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    'aria-hidden': true as const,
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function OverviewIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.75 20c0-3.45 2.8-6 6.25-6s6.25 2.55 6.25 6" />
      <path d="M16 5.2c1.4.35 2.5 1.6 2.5 3.1 0 1.5-1.1 2.75-2.5 3.1M18.5 14.3c1.85.5 3.25 2 3.25 4.2" />
    </svg>
  );
}

function WaitlistIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7 9.5h10M7 13.5h10M7 17.5h6" />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 3v7a2 2 0 0 0 2 2v9M5 3v5M7 3v5M9 3v7a2 2 0 0 1-2 2M18 3c-2 1.5-2 4-2 6s0 3 2 3v9" />
    </svg>
  );
}
