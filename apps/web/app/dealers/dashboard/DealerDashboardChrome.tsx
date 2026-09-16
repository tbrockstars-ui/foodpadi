'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../../../components/useTheme';
import {
  AnalyticsIcon,
  BackIcon,
  ChevronIcon,
  CloseIcon,
  LocationsIcon,
  LogoutIcon,
  MenuIcon,
  OverviewIcon,
  ProductsIcon,
  ProfileIcon,
  SettingsIcon,
  SubscriptionIcon,
  SupportIcon,
  VisibilityIcon,
} from './icons';
import styles from '../dealers.module.css';

export interface DealerSummary {
  name: string;
  listingStatus: string;
  isLiveToCustomers: boolean;
}

const NAV: {
  group: string | null;
  items: { href: string; label: string; icon: (p: { size?: number }) => JSX.Element; exact?: boolean }[];
}[] = [
  { group: null, items: [{ href: '/dealers/dashboard', label: 'Overview', icon: OverviewIcon, exact: true }] },
  {
    group: 'Manage',
    items: [
      { href: '/dealers/dashboard/products', label: 'Products', icon: ProductsIcon },
      { href: '/dealers/dashboard/locations', label: 'Locations', icon: LocationsIcon },
      { href: '/dealers/dashboard/profile', label: 'Profile', icon: ProfileIcon },
    ],
  },
  {
    group: 'Grow',
    items: [
      { href: '/dealers/dashboard/visibility', label: 'Search visibility', icon: VisibilityIcon },
      { href: '/dealers/dashboard/analytics', label: 'Analytics', icon: AnalyticsIcon },
      { href: '/dealers/dashboard/subscription', label: 'Subscription', icon: SubscriptionIcon },
    ],
  },
];

function statusLabel(d: DealerSummary): string {
  if (d.isLiveToCustomers) return 'Live on FoodPadi';
  if (d.listingStatus === 'pending_review') return 'Pending review';
  if (d.listingStatus === 'changes_requested') return 'Changes requested';
  if (d.listingStatus === 'approved') return 'Approved — not subscribed';
  if (d.listingStatus === 'rejected') return 'Application rejected';
  if (d.listingStatus === 'suspended') return 'Suspended';
  if (d.listingStatus === 'expired') return 'Subscription lapsed';
  return 'Draft';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FP';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((section, i) => (
        <div className={styles.navGroup} key={section.group ?? `top-${i}`}>
          {section.group ? <p className={styles.navGroupLabel}>{section.group}</p> : null}
          {section.items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
      <div className={styles.navSpacer} />
      <div className={styles.navGroup}>
        <Link href="/help" className={styles.navItem} onClick={onNavigate}>
          <SupportIcon size={18} />
          Help &amp; support
        </Link>
        <Link href="/" className={styles.navItem} onClick={onNavigate}>
          <BackIcon size={18} />
          Back to FoodPadi
        </Link>
      </div>
    </>
  );
}

function AccountCard({ dealer }: { dealer: DealerSummary }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.sidebarFooter} ref={ref}>
      {open ? (
        <div className={styles.accountMenu} role="menu">
          <div className={styles.themeRow}>
            <span>Theme</span>
            <span className={styles.segmented}>
              <button
                type="button"
                className={`${styles.segment} ${theme === 'dark' ? styles.segmentActive : ''}`}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
              <button
                type="button"
                className={`${styles.segment} ${theme === 'default' ? styles.segmentActive : ''}`}
                aria-pressed={theme === 'default'}
                onClick={() => setTheme('default')}
              >
                Light
              </button>
            </span>
          </div>
          <div className={styles.menuDivider} />
          <Link href="/profile" className={styles.accountMenuItem} role="menuitem" onClick={() => setOpen(false)}>
            <SettingsIcon size={16} />
            Account settings
          </Link>
          <div className={styles.menuDivider} />
          <form action="/api/auth/logout" method="POST" className={styles.accountMenuForm}>
            <button type="submit" className={`${styles.accountMenuItem} ${styles.accountMenuDanger}`} role="menuitem">
              <LogoutIcon size={16} />
              Log out
            </button>
          </form>
        </div>
      ) : null}
      <button type="button" className={styles.accountCard} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.avatar} aria-hidden>
          {initials(dealer.name)}
        </span>
        <span className={styles.accountMeta}>
          <span className={styles.accountName}>{dealer.name}</span>
          <span className={styles.accountStatus}>{statusLabel(dealer)}</span>
        </span>
        <ChevronIcon size={16} className={styles.accountChevron} />
      </button>
    </div>
  );
}

/**
 * Application shell for /dealers/dashboard/* (dealer brief §4/§17/§24) —
 * grouped sidebar with an active-lime state, a bottom account card
 * (business name, status, theme, logout), and a mobile drawer. Purely
 * presentational chrome; every page still fetches and owns its own data.
 */
export function DealerDashboardChrome({ dealer, children }: { dealer: DealerSummary; children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar} aria-label="Dealer dashboard">
        <span className={styles.sidebarBrand}>
          <span className={styles.brandMark} aria-hidden>
            FP
          </span>
          FoodPadi Dealer
        </span>
        <NavLinks pathname={pathname} />
        <AccountCard dealer={dealer} />
      </aside>

      <div className={styles.main}>
        <div className={styles.mobileBar}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon size={20} />
          </button>
          <span className={styles.sidebarBrand} style={{ padding: 0, marginBottom: 0 }}>
            FoodPadi Dealer
          </span>
          <span style={{ width: 38 }} aria-hidden />
        </div>

        {drawerOpen ? (
          <>
            <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)} />
            <nav className={styles.drawer} aria-label="Dealer dashboard">
              <div className={styles.sidebar} style={{ position: 'static', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={styles.sidebarBrand} style={{ marginBottom: 0, padding: 'var(--space-xs) 0' }}>
                    <span className={styles.brandMark} aria-hidden>
                      FP
                    </span>
                    FoodPadi Dealer
                  </span>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label="Close menu"
                    onClick={() => setDrawerOpen(false)}
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
                <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
                <AccountCard dealer={dealer} />
              </div>
            </nav>
          </>
        ) : null}

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
