'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminDealerListItem, AdminDealerListResponse } from '@foodpadi/shared';
import styles from './dealers-admin.module.css';

const STATUSES = [
  '',
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'active',
  'rejected',
  'suspended',
  'expired',
];

export function DealersTable({ initial }: { initial: AdminDealerListResponse }) {
  const [data, setData] = useState(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [reportedOnly, setReportedOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (reportedOnly) params.set('filter', 'reported');
      setLoading(true);
      fetch(`/api/admin-proxy/admin/dealers?${params.toString()}`)
        .then((r) => r.json() as Promise<AdminDealerListResponse>)
        .then(setData)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, reportedOnly]);

  return (
    <>
      <div className={styles.filters}>
        <input placeholder="Search name / slug / owner email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'Any status'}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} />
          Reported only
        </label>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Business</th>
            <th>Owner</th>
            <th>Locality</th>
            <th>Listing</th>
            <th>Subscription</th>
            <th>Live</th>
            <th>Complete</th>
            <th>Rating</th>
            <th>Reports</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((d) => (
            <Row key={d.id} d={d} />
          ))}
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={9}>{loading ? 'Loading…' : 'No dealers match.'}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
        {data.total} dealer{data.total === 1 ? '' : 's'}
      </p>
    </>
  );
}

function Row({ d }: { d: AdminDealerListItem }) {
  return (
    <tr>
      <td>
        <Link href={`/admin/dealers/${d.id}`} className={styles.rowLink}>
          {d.name}
        </Link>
        {d.verificationStatus === 'verified' ? ' ✓' : ''}
      </td>
      <td>{d.ownerEmail}</td>
      <td>{d.primaryLocality ?? '—'}</td>
      <td>
        <span
          className={`${styles.pill} ${
            d.listingStatus === 'active'
              ? styles.pillActive
              : d.listingStatus === 'approved'
                ? styles.pillPending
                : d.listingStatus === 'pending_review' || d.listingStatus === 'changes_requested'
                  ? styles.pillWarn
                  : styles.pillOff
          }`}
        >
          {d.listingStatus.replace('_', ' ')}
        </span>
      </td>
      <td>{d.subscriptionActive ? d.subscriptionStatus : `${d.subscriptionStatus} (inactive)`}</td>
      <td>{d.isLiveToCustomers ? 'yes' : 'no'}</td>
      <td>{d.profileCompleteness}%</td>
      <td>{d.ratingAverage != null ? `${d.ratingAverage.toFixed(1)} ★ (${d.ratingCount})` : '—'}</td>
      <td>{d.openReports > 0 ? <span className={styles.reportBadge}>{d.openReports}</span> : '—'}</td>
    </tr>
  );
}
