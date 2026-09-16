'use client';

import { useState } from 'react';
import {
  DEALER_SERVICE_TYPES,
  DEALER_SERVICE_TYPE_LABELS,
  DEALER_TYPES,
  DEALER_TYPE_LABELS,
  type DealerOwnerLocationView,
  type DealerOwnerProductView,
  type DealerServiceType,
  type DealerType,
  type DealerView,
} from '@foodpadi/shared';
import { dealerApi } from '../../lib/dealerClient';
import styles from './dealers.module.css';

// ---------------------------------------------------------------------------
// A comma / Enter-driven chip input for the free-text taxonomy arrays.
export function ChipsField({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const parts = draft
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const merged = [...values];
    for (const p of parts) {
      if (!merged.some((v) => v.toLowerCase() === p.toLowerCase())) merged.push(p);
    }
    onChange(merged);
    setDraft('');
  };
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label} {hint ? <span className={styles.fieldHint}>· {hint}</span> : null}
      </span>
      <input
        className={styles.input}
        value={draft}
        placeholder={placeholder ?? 'Type and press Enter'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
      {values.length > 0 ? (
        <span className={styles.chips}>
          {values.map((v) => (
            <span key={v} className={styles.chip}>
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
              >
                ×
              </button>
            </span>
          ))}
        </span>
      ) : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Business identity + taxonomy + contact — used by the wizard's steps 1/2/4
// and, as a whole, by the dashboard Profile page.
export interface BusinessDraft {
  name: string;
  dealerType: DealerType;
  description: string;
  categories: string[];
  cuisines: string[];
  productKeywords: string[];
  dietaryTags: string[];
  serviceType: DealerServiceType[];
  phone: string;
  websiteUrl: string;
  orderUrl: string;
  whatsapp: string;
  openingHours: Record<string, string>;
}

export function draftFromDealer(d: DealerView): BusinessDraft {
  return {
    name: d.name,
    dealerType: d.dealerType,
    description: d.description ?? '',
    categories: d.categories,
    cuisines: d.cuisines,
    productKeywords: d.productKeywords,
    dietaryTags: d.dietaryTags,
    serviceType: d.serviceType,
    phone: d.phone ?? '',
    websiteUrl: d.websiteUrl ?? '',
    orderUrl: d.orderUrl ?? '',
    whatsapp: d.whatsapp ?? '',
    openingHours: d.openingHours ?? {},
  };
}

const DAYS: [keyof BusinessDraft['openingHours'], string][] = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
];

// ---------------------------------------------------------------------------
// Opening-hours: a time-picker per day (open/close) with a Closed toggle,
// instead of free-typed "09:00–18:00 or Closed". Serialises back to the exact
// string shape the API + isDealerOpenNow parser expect ("HH:MM-HH:MM" | "Closed").

type DayHours = { mode: 'unset' | 'open' | 'closed'; open: string; close: string };

const HHMM = /^(\d{1,2}):(\d{2})$/;
function pad(t: string): string {
  const m = HHMM.exec(t.trim());
  if (!m) return '';
  const h = Math.min(23, Math.max(0, Number(m[1])));
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function parseDayHours(value: string | undefined | null): DayHours {
  const v = (value ?? '').trim();
  if (!v) return { mode: 'unset', open: '', close: '' };
  if (/closed|shut/i.test(v)) return { mode: 'closed', open: '', close: '' };
  const m = /^(\d{1,2}:\d{2})\s*[-–—to]+\s*(\d{1,2}:\d{2})$/i.exec(v);
  if (m) return { mode: 'open', open: pad(m[1]), close: pad(m[2]) };
  return { mode: 'unset', open: '', close: '' };
}

export function serializeDayHours(d: DayHours): string {
  if (d.mode === 'closed') return 'Closed';
  if (d.mode === 'open' && HHMM.test(d.open) && HHMM.test(d.close)) {
    return `${pad(d.open)}-${pad(d.close)}`;
  }
  return '';
}

// 30-minute time slots, "00:00" … "23:30" — a plain <select> the dealer picks
// from (easier + more reliable than a native <input type="time"> spinner).
const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? '30' : '00';
  return `${String(h).padStart(2, '0')}:${m}`;
});

function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  // Local state is the source of truth WHILE editing — deriving it from the
  // serialized `value` every render would drop a half-entered day (open set,
  // close still blank serializes to "" → the field would clear itself).
  const [states, setStates] = useState<Record<string, DayHours>>(() => {
    const init: Record<string, DayHours> = {};
    for (const [key] of DAYS) init[key as string] = parseDayHours(value[key as string]);
    return init;
  });

  const push = (next: Record<string, DayHours>) => {
    setStates(next);
    const out: Record<string, string> = {};
    for (const [key] of DAYS) {
      const s = serializeDayHours(next[key as string]);
      if (s) out[key as string] = s;
    }
    onChange(out);
  };
  const setDay = (key: string, patch: Partial<DayHours>) =>
    push({ ...states, [key]: { ...states[key], ...patch } });

  const copyMondayToAll = () => {
    const mon = states.mon;
    const next: Record<string, DayHours> = {};
    for (const [key] of DAYS) next[key as string] = { ...mon };
    push(next);
  };

  return (
    <>
      <span className={styles.fieldLabel}>
        Opening hours <span className={styles.fieldHint}>· optional — pick a time, or mark the day Closed</span>
      </span>
      <div className={styles.hoursGrid}>
        {DAYS.map(([key, label]) => {
          const s = states[key as string];
          const closed = s.mode === 'closed';
          return (
            <div key={key as string} className={styles.hoursRow}>
              <span className={styles.hoursDay}>{label}</span>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={closed}
                style={closed ? { background: 'var(--danger-soft)', borderColor: 'var(--danger)' } : undefined}
                onClick={() => setDay(key as string, { mode: closed ? 'unset' : 'closed' })}
              >
                {closed ? 'Closed' : 'Open'}
              </button>
              {!closed ? (
                <span className={styles.hoursTimes}>
                  <select
                    className={styles.select}
                    aria-label={`${label} opens`}
                    value={s.open}
                    onChange={(e) => setDay(key as string, { mode: 'open', open: e.target.value })}
                  >
                    <option value="">—</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span aria-hidden className={styles.fieldHint}>
                    to
                  </span>
                  <select
                    className={styles.select}
                    aria-label={`${label} closes`}
                    value={s.close}
                    onChange={(e) => setDay(key as string, { mode: 'open', close: e.target.value })}
                  >
                    <option value="">—</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <button type="button" className={styles.chip} style={{ marginTop: 8 }} onClick={copyMondayToAll}>
        Copy Monday to every day
      </button>
    </>
  );
}

export function BusinessFields({
  draft,
  set,
  showName = true,
}: {
  draft: BusinessDraft;
  set: (patch: Partial<BusinessDraft>) => void;
  showName?: boolean;
}) {
  return (
    <>
      {showName ? (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Business name</span>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
      ) : null}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Business type</span>
        <select
          className={styles.select}
          value={draft.dealerType}
          onChange={(e) => set({ dealerType: e.target.value as DealerType })}
        >
          {DEALER_TYPES.map((t) => (
            <option key={t} value={t}>
              {DEALER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Business description <span className={styles.fieldHint}>· optional, shown on your page</span>
        </span>
        <textarea
          className={styles.textarea}
          value={draft.description}
          maxLength={2000}
          onChange={(e) => set({ description: e.target.value })}
        />
      </label>
    </>
  );
}

export function TaxonomyFields({
  draft,
  set,
}: {
  draft: BusinessDraft;
  set: (patch: Partial<BusinessDraft>) => void;
}) {
  return (
    <>
      <ChipsField
        label="Food categories"
        hint="e.g. African Food, Groceries, Prepared Food"
        values={draft.categories}
        onChange={(categories) => set({ categories })}
      />
      <ChipsField
        label="Cuisines"
        hint="e.g. Nigerian, Ghanaian, Caribbean"
        values={draft.cuisines}
        onChange={(cuisines) => set({ cuisines })}
      />
      <ChipsField
        label="Product keywords"
        hint="things customers might search for — Jollof Rice, Palm Oil, Egusi"
        values={draft.productKeywords}
        onChange={(productKeywords) => set({ productKeywords })}
      />
      <ChipsField
        label="Dietary tags"
        hint="optional — Halal, Vegan options, Gluten-free"
        values={draft.dietaryTags}
        onChange={(dietaryTags) => set({ dietaryTags })}
      />
      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <span className={styles.fieldLabel}>How do you serve customers?</span>
        <span className={styles.chips}>
          {DEALER_SERVICE_TYPES.map((s) => {
            const on = draft.serviceType.includes(s);
            return (
              <button
                type="button"
                key={s}
                className={styles.chip}
                aria-pressed={on}
                style={on ? { background: 'var(--primary-soft)', borderColor: 'var(--primary)' } : undefined}
                onClick={() =>
                  set({
                    serviceType: on
                      ? draft.serviceType.filter((x) => x !== s)
                      : [...draft.serviceType, s],
                  })
                }
              >
                {DEALER_SERVICE_TYPE_LABELS[s]}
              </button>
            );
          })}
        </span>
      </fieldset>
    </>
  );
}

export function ContactFields({
  draft,
  set,
}: {
  draft: BusinessDraft;
  set: (patch: Partial<BusinessDraft>) => void;
}) {
  return (
    <>
      <p className={styles.fieldHint} style={{ marginBottom: 'var(--space-md)' }}>
        Provide at least one way for customers to reach you. FoodPadi only ever shows the channels
        you fill in here — nothing is invented.
      </p>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Phone</span>
        <input className={styles.input} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Website</span>
        <input
          className={styles.input}
          value={draft.websiteUrl}
          placeholder="mybusiness.co.uk"
          onChange={(e) => set({ websiteUrl: e.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Ordering link <span className={styles.fieldHint}>· optional</span>
        </span>
        <input
          className={styles.input}
          value={draft.orderUrl}
          onChange={(e) => set({ orderUrl: e.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          WhatsApp number <span className={styles.fieldHint}>· optional</span>
        </span>
        <input
          className={styles.input}
          value={draft.whatsapp}
          placeholder="+44…"
          onChange={(e) => set({ whatsapp: e.target.value })}
        />
      </label>

      <OpeningHoursEditor
        value={draft.openingHours}
        onChange={(openingHours) => set({ openingHours })}
      />
    </>
  );
}

// updatePayload — only the fields the portal PATCH accepts.
export function businessUpdatePayload(d: BusinessDraft) {
  const cleanHours = Object.fromEntries(
    Object.entries(d.openingHours).filter(([, v]) => v && v.trim()),
  );
  return {
    name: d.name.trim(),
    dealerType: d.dealerType,
    description: d.description.trim() || null,
    categories: d.categories,
    cuisines: d.cuisines,
    productKeywords: d.productKeywords,
    dietaryTags: d.dietaryTags,
    serviceType: d.serviceType,
    phone: d.phone.trim() || null,
    websiteUrl: d.websiteUrl.trim() || null,
    orderUrl: d.orderUrl.trim() || null,
    whatsapp: d.whatsapp.trim() || null,
    openingHours: Object.keys(cleanHours).length ? cleanHours : null,
  };
}

// ---------------------------------------------------------------------------
// Products editor — add / edit / remove, used by the wizard step 2 and the
// dashboard Products page. Optimistic-ish: re-reads the DealerView after each
// mutation via `onChange`.
export function ProductsEditor({
  products,
  onChange,
}: {
  products: DealerOwnerProductView[];
  onChange: (d: DealerView) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const pricePence = price.trim() ? Math.round(parseFloat(price) * 100) : null;
      const d = await dealerApi.addProduct({
        name: name.trim(),
        category: category.trim() || null,
        pricePence: Number.isFinite(pricePence as number) ? pricePence : null,
      });
      onChange(d);
      setName('');
      setCategory('');
      setPrice('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that product.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      onChange(await dealerApi.removeProduct(id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={styles.itemList}>
        {products.map((p) => (
          <div key={p.id} className={styles.item}>
            <div>
              <strong>{p.name}</strong>
              <div className={styles.itemMeta}>
                {[p.category, p.priceText, p.available ? null : 'Unavailable'].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button type="button" className={styles.chip} onClick={() => remove(p.id)} disabled={busy}>
              Remove
            </button>
          </div>
        ))}
        {products.length === 0 ? <p className={styles.itemMeta}>No products yet.</p> : null}
      </div>

      <div className={styles.chipInputRow} style={{ marginTop: 'var(--space-md)' }}>
        <input
          className={styles.input}
          style={{ flex: '2 1 160px' }}
          placeholder="Product name — e.g. Jollof Rice"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={styles.input}
          style={{ flex: '1 1 120px' }}
          placeholder="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <input
          className={styles.input}
          style={{ width: 110 }}
          placeholder="£ price"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button type="button" className={styles.ctaSecondary} onClick={add} disabled={busy}>
          Add
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Locations editor.
export function LocationsEditor({
  locations,
  onChange,
}: {
  locations: DealerOwnerLocationView[];
  onChange: (d: DealerView) => void;
}) {
  const [locality, setLocality] = useState('');
  const [postcode, setPostcode] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!locality.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const d = await dealerApi.addLocation({
        locality: locality.trim(),
        postcode: postcode.trim() || null,
        serviceAreas: serviceAreas
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      onChange(d);
      setLocality('');
      setPostcode('');
      setServiceAreas('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that location.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      onChange(await dealerApi.removeLocation(id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={styles.itemList}>
        {locations.map((l) => (
          <div key={l.id} className={styles.item}>
            <div>
              <strong>
                {l.locality}
                {l.isPrimary ? ' · primary' : ''}
              </strong>
              <div className={styles.itemMeta}>
                {[l.postcode, l.serviceAreas.length ? `Serves: ${l.serviceAreas.join(', ')}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <button type="button" className={styles.chip} onClick={() => remove(l.id)} disabled={busy}>
              Remove
            </button>
          </div>
        ))}
        {locations.length === 0 ? <p className={styles.itemMeta}>No locations yet.</p> : null}
      </div>

      <div className={styles.chipInputRow} style={{ marginTop: 'var(--space-md)' }}>
        <input
          className={styles.input}
          style={{ flex: '2 1 140px' }}
          placeholder="Town / city — e.g. Leicester"
          value={locality}
          onChange={(e) => setLocality(e.target.value)}
        />
        <input
          className={styles.input}
          style={{ width: 120 }}
          placeholder="Postcode"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
        />
        <input
          className={styles.input}
          style={{ flex: '2 1 160px' }}
          placeholder="Also serves (comma separated)"
          value={serviceAreas}
          onChange={(e) => setServiceAreas(e.target.value)}
        />
        <button type="button" className={styles.ctaSecondary} onClick={add} disabled={busy}>
          Add
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
