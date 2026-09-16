'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BIRTH_MONTHS, avatarOptionsForMonth, parseAvatarId, type AvatarOption } from '@foodpadi/shared';
import styles from './profile.module.css';

/**
 * Birth-month avatar picker (user instruction 2026-09-11) — "beautiful icons
 * that represent their birth month". Picking a month is its own save
 * (defaults future visits to this picker); picking a shade swatch saves the
 * avatar itself immediately — no separate "Save" button, so choosing feels
 * like trying on options rather than filling in a form.
 */
export function AvatarSection({
  initialBirthMonth,
  initialAvatarId,
}: {
  initialBirthMonth: number | null;
  initialAvatarId: string | null;
}) {
  const router = useRouter();
  const current = parseAvatarId(initialAvatarId);
  const [month, setMonth] = useState(initialBirthMonth ?? current?.month ?? new Date().getMonth() + 1);
  const [avatarId, setAvatarId] = useState(initialAvatarId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Could not save. Please try again.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Could not save. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onMonthChange = async (newMonth: number) => {
    setMonth(newMonth);
    await patch({ birthMonth: newMonth });
  };

  const pick = async (option: AvatarOption) => {
    const ok = await patch({ avatarId: option.id, ...(initialBirthMonth == null ? { birthMonth: month } : {}) });
    if (ok) setAvatarId(option.id);
  };

  const clear = async () => {
    const ok = await patch({ avatarId: null });
    if (ok) setAvatarId(null);
  };

  const shadeOptions = avatarOptionsForMonth(month);
  const active = parseAvatarId(avatarId);

  return (
    <div>
      <div className={styles.avatarPreviewRow}>
        <span
          className={styles.avatarPreview}
          style={
            active
              ? { background: `linear-gradient(155deg, ${active.colorFrom}, ${active.colorTo})`, color: active.textColor }
              : undefined
          }
          aria-hidden
        >
          {active ? active.emoji : '🙂'}
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {active ? `${active.monthLabel} · ${active.shadeLabel}` : 'No avatar chosen yet'}
          </p>
          {active ? (
            <button type="button" className={styles.linkButton} onClick={clear} disabled={busy}>
              Remove — show my initials instead
            </button>
          ) : (
            <p className={styles.emptyText} style={{ margin: 0 }}>
              Pick your birth month below, then choose a shade you like.
            </p>
          )}
        </div>
      </div>

      <label className={styles.avatarMonthLabel}>
        Birth month
        <select
          className={styles.addInput}
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          disabled={busy}
          style={{ marginTop: 4 }}
        >
          {BIRTH_MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.avatarSwatchRow}>
        {shadeOptions.map((o) => (
          <button
            key={o.id}
            type="button"
            className={styles.avatarSwatch}
            style={{
              background: `linear-gradient(155deg, ${o.colorFrom}, ${o.colorTo})`,
              color: o.textColor,
              outline: avatarId === o.id ? '2px solid var(--primary)' : undefined,
              outlineOffset: 2,
            }}
            onClick={() => pick(o)}
            disabled={busy}
            aria-pressed={avatarId === o.id}
            aria-label={`${o.monthLabel} ${o.shadeLabel}`}
            title={`${o.monthLabel} · ${o.shadeLabel}`}
          >
            {o.emoji}
          </button>
        ))}
      </div>
      {error ? <p className={styles.emptyText} style={{ color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  );
}
