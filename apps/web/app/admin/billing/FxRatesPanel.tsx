'use client';

import { useState } from 'react';
import type { FxRatesView } from '@foodpadi/shared';
import { formatMoney } from '../../../lib/money';
import styles from './billing.module.css';

function ageLabel(view: FxRatesView): string {
  if (view.fetchedAt == null || view.ageHours == null) return 'never fetched';
  const when = new Date(view.fetchedAt).toLocaleString();
  if (view.ageHours < 1) return `updated <1h ago (${when})`;
  if (view.ageHours < 48) return `updated ${view.ageHours}h ago (${when})`;
  return `updated ${Math.floor(view.ageHours / 24)}d ago (${when})`;
}

/**
 * Admin dashboard — the daily FX snapshot behind the paywall's "estimated
 * local equivalent". Auto-refreshes on the API side once per ~20h; this
 * button forces it now. Display-only: it does not change what any payment
 * provider charges.
 */
export function FxRatesPanel({ initial }: { initial: FxRatesView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = view.ageHours == null || view.ageHours >= 24;

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin-proxy/admin/billing/fx/refresh', { method: 'POST' });
      if (!res.ok) throw new Error();
      setView((await res.json()) as FxRatesView);
    } catch {
      setError('Refresh failed — the FX feed may be unreachable. The last-known rates are still shown.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Exchange rates (daily)</legend>
      <div className={styles.statusRow}>
        <span className={`${styles.badge} ${stale ? styles.badgeOff : styles.badgeOn}`}>
          {ageLabel(view)}
        </span>
        {view.source ? <span className={styles.savedAt}>source: {view.source}</span> : null}
        <button type="button" className={styles.addBtn} onClick={refresh} disabled={busy}>
          {busy ? 'Refreshing…' : 'Refresh rates now'}
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <p className={styles.hint}>
        The paywall shows the base price converted at these rates, always labelled an estimate. The
        payment provider&apos;s checkout amount is what the customer is actually charged.
      </p>

      <div className={styles.fxTableWrap}>
        <table className={styles.fxTable}>
          <thead>
            <tr>
              <th>Currency</th>
              <th>Rate (per $1)</th>
              <th>Estimated price</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.currency} className={r.rate == null ? styles.fxRowMissing : undefined}>
                <td>{r.currency.toUpperCase()}</td>
                <td>{r.rate == null ? '—' : r.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td>{r.estimated ? `${formatMoney(r.estimated)}/mo` : 'USD only'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
