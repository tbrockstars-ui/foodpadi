'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminDealerAction, AdminDealerDetail } from '@foodpadi/shared';
import { DEALER_TYPE_LABELS } from '@foodpadi/shared';
import styles from '../dealers-admin.module.css';

export function DealerAdminPanel({ initial }: { initial: AdminDealerDetail }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mutate(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-proxy/admin/dealers/${d.id}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      const body = await res.text();
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = JSON.parse(body) as { message?: string | string[] };
          msg = Array.isArray(j.message) ? j.message.join('. ') : j.message ?? msg;
        } catch {
          /* keep */
        }
        throw new Error(msg);
      }
      if (body) setD(JSON.parse(body) as AdminDealerDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  const act = (action: AdminDealerAction, note?: string) =>
    mutate('/action', { method: 'POST', body: JSON.stringify(note ? { action, note } : { action }) });

  // Admin-approval-before-payment (2026-09-11): reject / request_changes both
  // require a note the dealer will see verbatim. An inline field rather than a
  // native prompt() — clearer for the admin, and consistent with the rest of
  // this panel's inline-editing pattern.
  const [noteDraft, setNoteDraft] = useState<{ action: 'reject' | 'request_changes'; text: string } | null>(null);
  const submitNote = () => {
    if (!noteDraft || !noteDraft.text.trim()) return;
    act(noteDraft.action, noteDraft.text.trim());
    setNoteDraft(null);
  };

  const removeProduct = (productId: string) =>
    mutate(`/products/${productId}`, { method: 'DELETE' });

  const resolveReport = (reportId: string, status: 'reviewed' | 'actioned' | 'dismissed') =>
    mutate(`/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify({ status }) });

  const setRatingHidden = (ratingId: string, hidden: boolean) =>
    mutate(`/ratings/${ratingId}`, { method: 'PATCH', body: JSON.stringify({ hidden }) });

  const openReports = d.reports.filter((r) => r.status === 'open');

  return (
    <div className={styles.detailGrid}>
      <div className={styles.card}>
        <h2>Status</h2>
        <dl className={styles.kv}>
          <dt>Application</dt>
          <dd>{d.listingStatus.replace('_', ' ')}</dd>
          <dt>Live to customers</dt>
          <dd>{d.isLiveToCustomers ? 'yes' : 'no'}</dd>
          <dt>Subscription</dt>
          <dd>
            {d.subscriptionStatus} {d.subscriptionActive ? '(active)' : '(inactive)'}
          </dd>
          <dt>Verified</dt>
          <dd>{d.verificationStatus}</dd>
          <dt>Featured eligible</dt>
          <dd>{d.featuredEligible ? 'yes' : 'no'}</dd>
          <dt>Completeness</dt>
          <dd>{d.profileCompleteness}%</dd>
          <dt>Customer rating</dt>
          <dd>{d.ratingAverage != null ? `${d.ratingAverage.toFixed(1)} ★ (${d.ratingCount})` : 'No ratings yet'}</dd>
          <dt>Public page</dt>
          <dd>
            <Link href={`/dealer/${d.slug}`} target="_blank">
              /dealer/{d.slug}
            </Link>
          </dd>
        </dl>

        {d.approvalNote ? (
          <div className={styles.noteBox}>
            <strong>{d.listingStatus === 'rejected' ? 'Rejection reason' : 'Note to dealer'}:</strong> {d.approvalNote}
          </div>
        ) : null}

        <div className={styles.actionRow}>
          {d.listingStatus === 'pending_review' ? (
            <>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act('approve')} disabled={busy}>
                Approve
              </button>
              <button
                className={styles.btn}
                onClick={() => setNoteDraft({ action: 'request_changes', text: '' })}
                disabled={busy}
              >
                Request changes
              </button>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => setNoteDraft({ action: 'reject', text: '' })}
                disabled={busy}
              >
                Reject
              </button>
            </>
          ) : null}
          {d.listingStatus === 'changes_requested' ? (
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => setNoteDraft({ action: 'reject', text: '' })}
              disabled={busy}
            >
              Reject
            </button>
          ) : null}
          {d.listingStatus === 'approved' ? (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
              Approved — waiting for the dealer to subscribe. Not searchable until they do.
            </span>
          ) : null}
          {d.listingStatus === 'suspended' ? (
            <button className={styles.btn} onClick={() => act('reactivate')} disabled={busy}>
              Reactivate
            </button>
          ) : null}
          {d.listingStatus === 'expired' ? (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
              Expired — restores automatically when the dealer renews.
            </span>
          ) : null}
          {!['suspended', 'draft', 'rejected'].includes(d.listingStatus) ? (
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => act('suspend')} disabled={busy}>
              Suspend
            </button>
          ) : null}
          {d.verificationStatus === 'verified' ? (
            <button className={styles.btn} onClick={() => act('unverify')} disabled={busy}>
              Remove Verified
            </button>
          ) : (
            <button className={styles.btn} onClick={() => act('verify')} disabled={busy}>
              Mark FoodPadi Verified
            </button>
          )}
        </div>

        {noteDraft ? (
          <div className={styles.noteBox} style={{ marginTop: 'var(--space-sm)' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13 }}>
              {noteDraft.action === 'reject' ? 'Reason for rejecting (shown to the dealer)' : 'What should the dealer change? (shown to them verbatim)'}
            </p>
            <textarea
              autoFocus
              value={noteDraft.text}
              onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
              rows={3}
              style={{ width: '100%', resize: 'vertical', font: 'inherit', padding: 8 }}
            />
            <div className={styles.actionRow} style={{ marginTop: 8 }}>
              <button
                className={`${styles.btn} ${noteDraft.action === 'reject' ? styles.btnDanger : styles.btnPrimary}`}
                onClick={submitNote}
                disabled={busy || !noteDraft.text.trim()}
              >
                {noteDraft.action === 'reject' ? 'Confirm reject' : 'Send to dealer'}
              </button>
              <button className={styles.btn} onClick={() => setNoteDraft(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className={styles.err}>{error}</p> : null}
      </div>

      <div className={styles.card}>
        <h2>Business</h2>
        <dl className={styles.kv}>
          <dt>Owner</dt>
          <dd>{d.ownerEmail}</dd>
          <dt>Type</dt>
          <dd>{DEALER_TYPE_LABELS[d.dealerType]}</dd>
          <dt>Categories</dt>
          <dd>{d.categories.join(', ') || '—'}</dd>
          <dt>Cuisines</dt>
          <dd>{d.cuisines.join(', ') || '—'}</dd>
          <dt>Contact</dt>
          <dd>{[d.phone, d.websiteUrl, d.orderUrl, d.whatsapp].filter(Boolean).join(' · ') || '—'}</dd>
          <dt>Description</dt>
          <dd>{d.description || '—'}</dd>
        </dl>
      </div>

      <div className={styles.card}>
        <h2>Locations</h2>
        <ul className={styles.list}>
          {d.locations.map((l) => (
            <li key={l.id} className={styles.listItem}>
              <span>
                {l.locality}
                {l.isPrimary ? ' · primary' : ''}
                {l.serviceAreas.length ? ` · serves ${l.serviceAreas.join(', ')}` : ''}
              </span>
            </li>
          ))}
          {d.locations.length === 0 ? <li className={styles.listItem}>None</li> : null}
        </ul>
      </div>

      <div className={styles.card}>
        <h2>Products</h2>
        <ul className={styles.list}>
          {d.products.map((p) => (
            <li key={p.id} className={styles.listItem}>
              <span>
                {p.name}
                {p.category ? ` · ${p.category}` : ''}
                {p.priceText ? ` · ${p.priceText}` : ''}
              </span>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => removeProduct(p.id)} disabled={busy}>
                Remove
              </button>
            </li>
          ))}
          {d.products.length === 0 ? <li className={styles.listItem}>None</li> : null}
        </ul>
      </div>

      <div className={styles.card}>
        <h2>Reports ({openReports.length} open)</h2>
        <ul className={styles.list}>
          {d.reports.map((r) => (
            <li key={r.id} className={styles.listItem}>
              <span>
                <strong>{r.reason}</strong> · {r.status}
                {r.detail ? ` — ${r.detail}` : ''}
                <br />
                <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </span>
              {r.status === 'open' ? (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button className={styles.btn} onClick={() => resolveReport(r.id, 'actioned')} disabled={busy}>
                    Actioned
                  </button>
                  <button className={styles.btn} onClick={() => resolveReport(r.id, 'dismissed')} disabled={busy}>
                    Dismiss
                  </button>
                </span>
              ) : null}
            </li>
          ))}
          {d.reports.length === 0 ? <li className={styles.listItem}>No reports</li> : null}
        </ul>
      </div>

      <div className={styles.card}>
        <h2>Ratings ({d.ratingCount})</h2>
        <ul className={styles.list}>
          {d.ratings.map((r) => (
            <li key={r.id} className={styles.listItem}>
              <span>
                <strong>{r.rating} ★</strong>
                {r.hidden ? ' · hidden' : ''}
                {r.comment ? ` — ${r.comment}` : ''}
                <br />
                <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </span>
              <button
                className={r.hidden ? styles.btn : `${styles.btn} ${styles.btnDanger}`}
                onClick={() => setRatingHidden(r.id, !r.hidden)}
                disabled={busy}
              >
                {r.hidden ? 'Unhide' : 'Hide'}
              </button>
            </li>
          ))}
          {d.ratings.length === 0 ? <li className={styles.listItem}>No ratings yet</li> : null}
        </ul>
      </div>

      <div className={styles.card}>
        <h2>Application history</h2>
        <ul className={styles.audit}>
          {d.auditLog.map((a, i) => (
            <li key={i}>
              <strong>{a.action.replace(/_/g, ' ')}</strong>
              {a.previousStatus && a.newStatus ? ` — ${a.previousStatus} → ${a.newStatus}` : ''}
              {a.reason ? `: ${a.reason}` : ''}
              <span className={styles.auditTime}>{new Date(a.createdAt).toLocaleString()}</span>
            </li>
          ))}
          {d.auditLog.length === 0 ? <li className={styles.listItem}>No history yet</li> : null}
        </ul>
      </div>
    </div>
  );
}
