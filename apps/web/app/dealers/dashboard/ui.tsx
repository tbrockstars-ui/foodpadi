// Pure, server-renderable presentational pieces shared across the dealer
// dashboard pages (dealer brief §6/§13/§20/§26). No 'use client' — every page
// that is itself a Server Component can use these directly; client pages
// (products/profile editors) use them too since they take plain props.
import type { ReactNode } from 'react';
import styles from '../dealers.module.css';

// --------------------------------------------------------------- header ---
export function PageHeader({
  title,
  description,
  actions,
  kicker,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  kicker?: string;
}) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderMain}>
        {kicker ? <p className={styles.greetKicker}>{kicker}</p> : null}
        <h1 className={styles.headerTitle}>{title}</h1>
        {description ? <p className={styles.headerDesc}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.pageHeaderActions}>{actions}</div> : null}
    </div>
  );
}

// --------------------------------------------------------------- panel ----
export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.panel}>
      {title ? (
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.panelTitle}>{title}</p>
            {subtitle ? <p className={styles.panelSub}>{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

// -------------------------------------------------------------- metrics ---
export interface Metric {
  label: string;
  value: number | null;
  deltaPct?: number | null;
  format?: 'int' | 'pct';
}

/** A single metric tile. `value === null` renders the professional "—" empty
    state instead of a misleading "0" (dealer brief §14). */
export function MetricCard({ label, value, deltaPct, format = 'int' }: Metric) {
  const hasValue = value !== null && value !== undefined;
  const display = hasValue ? (format === 'pct' ? `${value}%` : value.toLocaleString()) : '—';
  return (
    <div className={styles.metricCard}>
      <p className={styles.metricLabel}>{label}</p>
      <div className={`${styles.metricValue} ${hasValue ? '' : styles.metricValueEmpty}`}>{display}</div>
      {hasValue && deltaPct !== undefined && deltaPct !== null ? (
        <div className={`${styles.metricDelta} ${deltaPct >= 0 ? styles.deltaUp : styles.deltaDown}`}>
          {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}%
        </div>
      ) : null}
    </div>
  );
}

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className={styles.metricGrid}>
      {metrics.map((m) => (
        <MetricCard key={m.label} {...m} />
      ))}
    </div>
  );
}

// ----------------------------------------------------------- bar chart ----
export function BarChart({
  rows,
  amber = false,
}: {
  rows: { label: string; value: number }[];
  amber?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={styles.barChart}>
      {rows.map((r) => (
        <div className={styles.barRow} key={r.label}>
          <span className={styles.barLabel}>{r.label}</span>
          <span className={styles.barTrack}>
            <span
              className={`${styles.barFill} ${amber ? styles.barFillAmber : ''}`}
              style={{ width: `${Math.round((r.value / max) * 100)}%` }}
            />
          </span>
          <span className={styles.barValue}>{r.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ badges ------
export function StatusBadge({
  tone,
  children,
}: {
  tone: 'lime' | 'amber' | 'green' | 'neutral' | 'red';
  children: ReactNode;
}) {
  const cls = {
    lime: styles.badgeLime,
    amber: styles.badgeAmber,
    green: styles.badgeGreen,
    neutral: styles.badgeNeutral,
    red: styles.badgeRed,
  }[tone];
  return (
    <span className={`${styles.badge} ${cls}`}>
      <span className={styles.badgeDot} />
      {children}
    </span>
  );
}

// ------------------------------------------------------------- empty ------
export function EmptyState({
  icon = '📊',
  title,
  text,
  action,
}: {
  icon?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon} aria-hidden>
        {icon}
      </div>
      <p className={styles.emptyTitle}>{title}</p>
      {text ? <p className={styles.emptyText}>{text}</p> : null}
      {action}
    </div>
  );
}

// ----------------------------------------------------------- skeleton -----
export function Skeleton({ className }: { className?: string }) {
  return <div className={`${styles.skeleton} ${className ?? ''}`} />;
}

// ------------------------------------------------------------- insight ----
export function Insight({ text }: { text: string }) {
  return (
    <div className={styles.insight}>
      <span className={styles.insightIcon} aria-hidden>
        💡
      </span>
      <p className={styles.insightText}>{text}</p>
    </div>
  );
}

// -------------------------------------------------------- score ring ------
export function ScoreRing({ pct }: { pct: number }) {
  return (
    <div className={styles.scoreRing} style={{ ['--pct' as string]: pct }}>
      <div className={styles.scoreRingInner}>{pct}%</div>
    </div>
  );
}

// -------------------------------------------------------- date helper -----
export function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (ms < 0) return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < day) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 30 * day) return `${Math.floor(ms / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
