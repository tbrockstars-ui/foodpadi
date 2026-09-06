'use client';

import { useState } from 'react';
import type { ScannedItemView } from '@foodpadi/shared';
import styles from './cook-today.module.css';
import { readImageFile } from './imageCapture';

interface Props {
  /** Adds the given ingredient names to the parent's selection (dedupes there). */
  onAddIngredients: (names: string[]) => void;
}

/**
 * Web counterpart to apps/mobile/src/screens/ScanScreen.tsx's "pantry" mode
 * — account-only (POST /scan/photo is JwtAuthGuard), so this is only
 * rendered for a signed-in user (see CookTodayForm.tsx). No demo-scenario
 * shortcut here (that's a mobile-only affordance); a real photo is always
 * required on web.
 */
export function ScanKitchen({ onAddIngredients }: Props) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ScannedItemView[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setItems(null);
    setScanning(true);
    try {
      const { base64, mediaType } = await readImageFile(file);
      const res = await fetch('/api/proxy/scan/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      if (res.status === 503) {
        throw new Error("Scan isn't ready yet — the photo analyser isn't configured. Check back soon.");
      }
      if (!res.ok) throw new Error('Something went wrong analysing that photo. Please try again.');
      const data = (await res.json()) as { items: ScannedItemView[] };
      setItems(data.items);
      setSelected(new Set(data.items.map((i) => i.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong analysing that photo.');
    } finally {
      setScanning(false);
    }
  };

  const toggle = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const confirm = () => {
    onAddIngredients([...selected]);
    setItems(null);
  };

  return (
    <div>
      <label className={styles.secondaryButton} style={{ cursor: 'pointer', display: 'inline-block' }}>
        {scanning ? 'Scanning…' : '📷 Scan my kitchen'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handlePhotoChange}
          disabled={scanning}
          style={{ display: 'none' }}
        />
      </label>
      {error ? <p className={styles.errorText}>{error}</p> : null}

      {items ? (
        items.length === 0 ? (
          <p className={styles.emptyText}>Couldn&apos;t spot anything in that photo — try a clearer, well-lit shot.</p>
        ) : (
          <div style={{ marginTop: 'var(--space-md)' }}>
            <p className={styles.sectionHeading}>Found in your photo</p>
            <div className={styles.chipWrap}>
              {items.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className={`${styles.chip} ${selected.has(item.name) ? styles.chipSelected : ''}`}
                  onClick={() => toggle(item.name)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={confirm}
              disabled={selected.size === 0}
              style={{ marginTop: 'var(--space-md)' }}
            >
              Add to my ingredients
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
