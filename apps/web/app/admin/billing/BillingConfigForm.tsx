'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BillingConfigView } from './types';
import styles from './billing.module.css';

interface CurrencyRow {
  code: string;
  amount: string; // minor units, as typed
}

function toRows(opts: Record<string, number>): CurrencyRow[] {
  return Object.entries(opts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, amount]) => ({ code, amount: String(amount) }));
}

export function BillingConfigForm({ initial }: { initial: BillingConfigView }) {
  const router = useRouter();

  const [basePrice, setBasePrice] = useState((initial.basePriceCents / 100).toFixed(2));
  const [baseCurrency, setBaseCurrency] = useState(initial.baseCurrency);
  const [trialDays, setTrialDays] = useState(String(initial.trialDays));
  const [pastDueGraceDays, setPastDueGraceDays] = useState(String(initial.pastDueGraceDays));
  const [flwNgnAmount, setFlwNgnAmount] = useState(String(initial.flwNgnAmount));
  const [dealerPrice, setDealerPrice] = useState((initial.dealerPriceCents / 100).toFixed(2));
  const [dealerNgn, setDealerNgn] = useState(String(initial.dealerNgnAmount));
  const [rows, setRows] = useState<CurrencyRow[]>(toRows(initial.currencyOptions));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);

  const setRow = (i: number, patch: Partial<CurrencyRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { code: '', amount: '' }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const currencyOptions = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      const code = r.code.trim().toLowerCase();
      const amount = Number(r.amount);
      if (/^[a-z]{3}$/.test(code) && Number.isInteger(amount) && amount > 0) {
        out[code] = amount;
      }
    }
    return out;
  }, [rows]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarnings([]);

    const cents = Math.round(Number(basePrice) * 100);
    if (!Number.isInteger(cents) || cents < 50) {
      setError('Base price must be at least 0.50.');
      return;
    }
    const dealerCents = Math.round(Number(dealerPrice) * 100);
    if (!Number.isInteger(dealerCents) || dealerCents < 50) {
      setError('Food Dealer price must be at least 0.50.');
      return;
    }
    const badRow = rows.find(
      (r) => (r.code.trim() || r.amount.trim()) && !/^[a-z]{3}$/i.test(r.code.trim()),
    );
    if (badRow) {
      setError(`"${badRow.code}" is not a 3-letter currency code.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin-proxy/admin/billing/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePriceCents: cents,
          baseCurrency: baseCurrency.trim().toLowerCase(),
          trialDays: Number(trialDays) || 0,
          pastDueGraceDays: Number(pastDueGraceDays) || 0,
          flwNgnAmount: Number(flwNgnAmount) || initial.flwNgnAmount,
          dealerPriceCents: dealerCents,
          dealerNgnAmount: Number(dealerNgn) || initial.dealerNgnAmount,
          currencyOptions,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        config?: BillingConfigView;
        warnings?: string[];
      };
      if (!res.ok) {
        setError(
          Array.isArray(data.message) ? data.message.join('. ') : data.message ?? 'Save failed.',
        );
        setSaving(false);
        return;
      }
      setWarnings(data.warnings ?? []);
      setSavedAt(data.config?.updatedAt ?? new Date().toISOString());
      if (data.config) {
        setRows(toRows(data.config.currencyOptions));
      }
      setSaving(false);
      router.refresh();
    } catch {
      setError('Save failed. Please try again.');
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.statusRow}>
        <Badge on={initial.stripeConfigured}>
          Stripe {initial.stripeDemo ? 'demo' : initial.stripeConfigured ? 'live' : 'not configured'}
        </Badge>
        <Badge on={initial.flutterwaveConfigured}>
          Flutterwave {initial.flutterwaveDemo ? 'demo' : initial.flutterwaveConfigured ? 'live' : 'not configured'}
        </Badge>
        {savedAt ? (
          <span className={styles.savedAt}>Last saved {new Date(savedAt).toLocaleString()}</span>
        ) : null}
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Base price</span>
          <div className={styles.inline}>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0.5"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
            />
            <input
              className={`${styles.input} ${styles.ccyInput}`}
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              maxLength={3}
              aria-label="Base currency"
            />
          </div>
          <span className={styles.hint}>The canonical commercial price. Changing it mints a new Stripe price.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Free trial (days)</span>
          <input
            className={styles.input}
            type="number"
            min="0"
            max="90"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
          <span className={styles.hint}>0 = charge immediately. Applies to new Stripe checkouts.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Payment-failure grace (days)</span>
          <input
            className={styles.input}
            type="number"
            min="0"
            max="30"
            value={pastDueGraceDays}
            onChange={(e) => setPastDueGraceDays(e.target.value)}
          />
          <span className={styles.hint}>
            Days a past-due subscription keeps Premium while the renewal retries. 0 = revoke immediately.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Nigeria price (₦ / month)</span>
          <input
            className={styles.input}
            type="number"
            min="100"
            value={flwNgnAmount}
            onChange={(e) => setFlwNgnAmount(e.target.value)}
          />
          <span className={styles.hint}>
            Whole Naira, charged via Flutterwave.{' '}
            {initial.flutterwaveDemo ? 'Demo mode — no real charge.' : `Plan: ${initial.flwPlanId ?? '—'}`}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Food Dealer price</span>
          <div className={styles.inline}>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0.5"
              value={dealerPrice}
              onChange={(e) => setDealerPrice(e.target.value)}
            />
            <span className={styles.hint} style={{ alignSelf: 'center' }}>
              / month, {baseCurrency.toUpperCase()}
            </span>
          </div>
          <span className={styles.hint}>
            FoodPadi Food Dealer Network subscription — a separate product from Premium. Changing it
            mints a new Stripe dealer price.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Food Dealer — Nigeria price (₦ / month)</span>
          <input
            className={styles.input}
            type="number"
            min="100"
            value={dealerNgn}
            onChange={(e) => setDealerNgn(e.target.value)}
          />
          <span className={styles.hint}>Whole Naira, charged via Flutterwave for the dealer plan.</span>
        </label>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Local currency prices (Stripe presentment)</legend>
        <p className={styles.hint}>
          Minor units — <code>449</code> = £4.49; for zero-decimal currencies (JPY) it&apos;s the
          whole amount. A country whose currency isn&apos;t listed sees {baseCurrency.toUpperCase()}.
        </p>
        <div className={styles.ccyRows}>
          {rows.map((r, i) => (
            <div className={styles.ccyRow} key={i}>
              <input
                className={`${styles.input} ${styles.ccyInput}`}
                value={r.code}
                onChange={(e) => setRow(i, { code: e.target.value })}
                placeholder="gbp"
                maxLength={3}
                aria-label={`Currency ${i + 1} code`}
              />
              <input
                className={styles.input}
                type="number"
                min="1"
                value={r.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
                placeholder="449"
                aria-label={`Currency ${i + 1} amount`}
              />
              <button type="button" className={styles.removeBtn} onClick={() => removeRow(i)} aria-label="Remove">
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className={styles.addBtn} onClick={addRow}>
          + Add currency
        </button>
      </fieldset>

      {error ? <p className={styles.error}>{error}</p> : null}
      {warnings.length > 0 ? (
        <div className={styles.warnBox}>
          <strong>Saved with warnings:</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className={styles.submitButton} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function Badge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={`${styles.badge} ${on ? styles.badgeOn : styles.badgeOff}`}>{children}</span>;
}
