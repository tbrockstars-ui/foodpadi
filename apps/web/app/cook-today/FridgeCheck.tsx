'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { IngredientCheckState, IngredientItem, RecipeIngredientView, ScannedItemView } from '@foodpadi/shared';
import { normalizeIngredientName, reconcileRescan } from '@foodpadi/shared';
import styles from './cook-today.module.css';
import { readImageFile } from './imageCapture';
import { trackClientEvent } from '../../lib/trackClientEvent';

type Stage = 'idle' | 'scanning' | 'reviewScan' | 'reconciled';

interface NeedEntry {
  name: string;
  /** A shortfall note ("1 more") when a partial quantity match was possible,
      or the recipe's own quantity/unit when there was no match at all — best
      effort only, see ingredientMatch.ts's own scope note. Null when neither
      side gave a usable quantity. */
  note: string | null;
}

function parseLeadingInt(quantity: string | null): number | null {
  if (!quantity) return null;
  const match = quantity.trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Same fuzzy substring-both-ways rule as haveItemsCoverIngredient, but
    returns the matched have-item itself (not just a boolean) so a quantity
    shortfall can be worked out where possible. */
function findHaveMatch(
  haveItems: ScannedItemView[],
  ingredientName: string,
): ScannedItemView | undefined {
  const ing = normalizeIngredientName(ingredientName);
  return haveItems.find((item) => {
    const name = normalizeIngredientName(item.name);
    return name.length > 1 && (ing.includes(name) || name.includes(ing));
  });
}

function reconcile(
  recipeIngredients: RecipeIngredientView[],
  haveItems: ScannedItemView[],
): { have: RecipeIngredientView[]; need: NeedEntry[] } {
  const have: RecipeIngredientView[] = [];
  const need: NeedEntry[] = [];

  for (const ingredient of recipeIngredients) {
    const match = findHaveMatch(haveItems, ingredient.name);
    if (!match) {
      need.push({
        name: ingredient.name,
        note: [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') || null,
      });
      continue;
    }
    const recipeQty = parseLeadingInt(ingredient.quantity);
    const haveQty = parseLeadingInt(match.quantity);
    if (recipeQty !== null && haveQty !== null && recipeQty > haveQty) {
      need.push({ name: ingredient.name, note: `${recipeQty - haveQty} more` });
      continue;
    }
    have.push(ingredient);
  }

  return { have, need };
}

/**
 * Optional fridge check, offered once a recipe is chosen (CookTodayForm's
 * 'detail' step). Reuses Scan's existing POST /scan/photo, then reconciles the
 * result against THIS recipe's ingredients. Only rendered for a signed-in
 * user.
 *
 * PERSISTENCE (docs cooking-journey brief §2/§34): every meaningful action —
 * scan, keep/reject a detected item, add "I also have X", tick a "to buy"
 * item — is debounce-saved onto the active Cooking Journey's
 * `ingredientState`, and the component HYDRATES from `initialState` on mount.
 * So logging out mid-review and back in resumes the exact comparison with no
 * rescan and no re-ticking. Before this, the state was client-only React
 * state with a lossy {have,need} projection and no read-back — the bug.
 *
 * Also owns the Start Cooking gate via `onReadyChange` — true once every "need
 * to buy" item is ticked off (or there was nothing to buy).
 */
export function FridgeCheck({
  recipeIngredients,
  onReadyChange,
  journeyId,
  initialState = null,
  initialShoppingListId = null,
}: {
  recipeIngredients: RecipeIngredientView[];
  onReadyChange: (ready: boolean) => void;
  journeyId?: string;
  /** The persisted fridge-scan / comparison session to resume from. */
  initialState?: IngredientCheckState | null;
  /** The journey's linked shopping list, if one was already created. */
  initialShoppingListId?: string | null;
}) {
  // --- hydrate from the persisted session (or start blank) -----------------
  const seeded = useMemo(() => {
    const s = initialState;
    if (!s) {
      return {
        stage: 'idle' as Stage,
        scannedItems: [] as ScannedItemView[],
        selected: new Set<string>(),
        manualHave: [] as IngredientItem[],
        have: [] as RecipeIngredientView[],
        need: [] as NeedEntry[],
        purchased: new Set<string>(),
        skipped: false,
        scannedAt: null as string | null,
      };
    }
    return {
      stage: s.subStage as Stage,
      scannedItems: s.detected,
      selected: new Set(s.confirmedNames),
      manualHave: s.manualHave,
      // Rebuild the "have" objects from the recipe — don't recompute the
      // comparison, just re-materialise what was stored (brief §34).
      have: recipeIngredients.filter((i) => s.haveNames.includes(i.name)),
      need: s.need,
      purchased: new Set(s.purchasedNames),
      skipped: s.skipped,
      scannedAt: s.scannedAt,
    };
  }, [initialState, recipeIngredients]);

  const [stage, setStage] = useState<Stage>(seeded.stage);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItemView[]>(seeded.scannedItems);
  const [selected, setSelected] = useState<Set<string>>(seeded.selected);
  const [manualHave, setManualHave] = useState<IngredientItem[]>(seeded.manualHave);
  const [have, setHave] = useState<RecipeIngredientView[]>(seeded.have);
  const [need, setNeed] = useState<NeedEntry[]>(seeded.need);
  const [purchased, setPurchased] = useState<Set<string>>(seeded.purchased);
  const [skipped, setSkipped] = useState(seeded.skipped);
  const [scannedAt, setScannedAt] = useState<string | null>(seeded.scannedAt);
  const [manualDraft, setManualDraft] = useState('');
  const [rescanFailed, setRescanFailed] = useState(false);

  const [addingToList, setAddingToList] = useState(false);
  const [listAdded, setListAdded] = useState(!!initialShoppingListId);
  const [listId, setListId] = useState<string | null>(initialShoppingListId);
  const [listError, setListError] = useState<string | null>(null);
  const shoppingCompletedFired = useRef(false);

  // --- persistence -------------------------------------------------------
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<IngredientCheckState | null>(null);

  const flush = (keepalive = false) => {
    const body = pending.current;
    if (!body || !journeyId) return;
    pending.current = null;
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    void fetch(`/api/proxy/cooking-journey/${journeyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'ingredient_check', ingredientState: body }),
      keepalive,
    }).catch(() => undefined);
  };

  /** Debounced save of the current (or a just-computed) session. */
  const persist = (state: IngredientCheckState) => {
    if (!journeyId) return;
    pending.current = state;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => flush(false), 400);
  };

  // Flush any pending change before the page goes away (a logout is a full
  // navigation — brief §16: best-effort, never blocks logout).
  useEffect(() => {
    const onHide = () => flush(true);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId]);

  // Build an IngredientCheckState from the current state, with overrides for
  // the value a handler just changed (setState is async, so the closure's
  // copy is stale).
  const snapshot = (o: Partial<IngredientCheckState> = {}): IngredientCheckState => ({
    v: 2,
    subStage: stage === 'reconciled' ? 'reconciled' : 'reviewScan',
    skipped,
    scannedAt,
    detected: scannedItems,
    confirmedNames: [...selected],
    manualHave,
    haveNames: have.map((h) => h.name),
    need,
    purchasedNames: [...purchased],
    ...o,
  });

  // one-shot "review started" analytics, once we have something to review
  const reviewStartedFired = useRef(false);
  useEffect(() => {
    if (!reviewStartedFired.current && (scannedItems.length > 0 || skipped)) {
      reviewStartedFired.current = true;
      trackClientEvent('cook_today_meal_selected'); // closest existing allowlisted event; server has ingredient_review_saved
    }
  }, [scannedItems.length, skipped]);

  // Start Cooking unlocks once every "need to buy" item is ticked off.
  useEffect(() => {
    const ready = stage === 'reconciled' && need.every((item) => purchased.has(item.name));
    onReadyChange(ready);
    if (ready && need.length > 0 && !shoppingCompletedFired.current) {
      shoppingCompletedFired.current = true;
      trackClientEvent('cook_today_shopping_completed', { itemCount: need.length });
    }
  }, [stage, need, purchased, onReadyChange]);

  // --- scan ------------------------------------------------------------
  const runScan = async (file: File): Promise<ScannedItemView[] | null> => {
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
    return data.items;
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isRescan = stage === 'reconciled' || (stage === 'reviewScan' && scannedItems.length > 0);
    setError(null);
    setRescanFailed(false);
    setScanning(true);
    try {
      const items = (await runScan(file)) ?? [];
      const now = new Date().toISOString();
      if (isRescan) {
        // Merge against saved decisions — brief §21/§22: a new scan never
        // silently undoes a confirm/reject.
        const merged = reconcileRescan({ detected: scannedItems, confirmedNames: [...selected] }, items);
        setScannedItems(merged.detected);
        setSelected(new Set(merged.confirmedNames));
        setScannedAt(now);
        setStage('reviewScan');
        persist(
          snapshot({
            subStage: 'reviewScan',
            detected: merged.detected,
            confirmedNames: merged.confirmedNames,
            scannedAt: now,
            skipped: false,
          }),
        );
      } else {
        setScannedItems(items);
        setSelected(new Set(items.map((i) => i.name)));
        setScannedAt(now);
        setStage('reviewScan');
        persist(
          snapshot({
            subStage: 'reviewScan',
            detected: items,
            confirmedNames: items.map((i) => i.name),
            scannedAt: now,
            skipped: false,
          }),
        );
      }
    } catch (err) {
      setRescanFailed(isRescan);
      setError(err instanceof Error ? err.message : 'Something went wrong analysing that photo.');
      // §23: a failed rescan never destroys the previous check — state is untouched.
    } finally {
      setScanning(false);
    }
  };

  const toggleSelected = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
    persist(snapshot({ confirmedNames: [...next] }));
  };

  const confirmedItems = (): ScannedItemView[] => [
    ...scannedItems.filter((i) => selected.has(i.name)),
    ...manualHave,
  ];

  const runReconcile = (confirmed: ScannedItemView[]): { have: RecipeIngredientView[]; need: NeedEntry[] } => {
    const result = reconcile(recipeIngredients, confirmed);
    setHave(result.have);
    setNeed(result.need);
    return result;
  };

  const confirmScan = async () => {
    const confirmed = confirmedItems();
    // Persist to the real Pantry table too (best-effort, unchanged).
    fetch('/api/proxy/pantry/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: confirmed.map((item) => ({
          name: item.name,
          quantity: item.quantity ?? undefined,
          unit: item.unit ?? undefined,
        })),
      }),
    }).catch(() => undefined);

    const { have: haveList, need: needList } = runReconcile(confirmed);
    setSkipped(false);
    shoppingCompletedFired.current = false;
    setStage('reconciled');
    persist(
      snapshot({
        subStage: 'reconciled',
        skipped: false,
        haveNames: haveList.map((h) => h.name),
        need: needList,
      }),
    );
  };

  const skipScan = () => {
    const { have: haveList, need: needList } = runReconcile(manualHave);
    setSkipped(true);
    shoppingCompletedFired.current = false;
    setStage('reconciled');
    setScannedItems([]);
    setSelected(new Set());
    persist(
      snapshot({
        subStage: 'reconciled',
        skipped: true,
        detected: [],
        confirmedNames: [],
        haveNames: haveList.map((h) => h.name),
        need: needList,
      }),
    );
  };

  const togglePurchased = (name: string) => {
    const next = new Set(purchased);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setPurchased(next);
    persist(snapshot({ purchasedNames: [...next] }));
    // keep any linked shopping list row in step
    if (listId) {
      void fetch(`/api/proxy/plan-ahead/shopping-lists/${listId}`, { method: 'GET' })
        .then((r) => (r.ok ? r.json() : null))
        .then((list: { items?: { id: string; ingredientName: string }[] } | null) => {
          const row = list?.items?.find((it) => it.ingredientName === name);
          if (!row) return;
          void fetch(`/api/proxy/plan-ahead/shopping-lists/${listId}/items/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checked: next.has(name) }),
          }).catch(() => undefined);
        })
        .catch(() => undefined);
    }
  };

  const addManualHave = () => {
    const name = manualDraft.trim();
    if (!name) return;
    if (manualHave.some((m) => normalizeIngredientName(m.name) === normalizeIngredientName(name))) {
      setManualDraft('');
      return;
    }
    const nextManual = [...manualHave, { name, quantity: null, unit: null }];
    setManualHave(nextManual);
    setManualDraft('');
    // re-reconcile with the new "I also have" item
    const confirmed = [...scannedItems.filter((i) => selected.has(i.name)), ...nextManual];
    const { have: haveList, need: needList } = runReconcile(confirmed);
    // an item that's no longer needed shouldn't stay "ticked to buy"
    const nextPurchased = new Set([...purchased].filter((p) => needList.some((n) => n.name === p)));
    setPurchased(nextPurchased);
    persist(
      snapshot({
        manualHave: nextManual,
        haveNames: haveList.map((h) => h.name),
        need: needList,
        purchasedNames: [...nextPurchased],
      }),
    );
  };

  const removeManualHave = (name: string) => {
    const nextManual = manualHave.filter((m) => m.name !== name);
    setManualHave(nextManual);
    const confirmed = [...scannedItems.filter((i) => selected.has(i.name)), ...nextManual];
    const { have: haveList, need: needList } = runReconcile(confirmed);
    persist(
      snapshot({ manualHave: nextManual, haveNames: haveList.map((h) => h.name), need: needList }),
    );
  };

  const addToShoppingList = async () => {
    if (need.length === 0) return;
    setAddingToList(true);
    setListError(null);
    try {
      const res = await fetch('/api/proxy/plan-ahead/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: need.map((n) => ({ ingredientName: n.name })),
          ...(journeyId ? { cookingJourneyId: journeyId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Couldn't create a shopping list right now. Please try again.");
      const list = (await res.json()) as { id: string };
      setListId(list.id);
      setListAdded(true);
      persist(snapshot());
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't create a shopping list right now.");
    } finally {
      setAddingToList(false);
    }
  };

  const scanAgainButton = (
    <label className={styles.secondaryButton} style={{ cursor: 'pointer', display: 'inline-block' }}>
      {scanning ? 'Scanning…' : '📷 Scan again'}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handlePhotoChange}
        disabled={scanning}
        style={{ display: 'none' }}
      />
    </label>
  );

  if (stage === 'reconciled') {
    const haveChips = [...have.map((i) => i.name), ...manualHave.map((m) => m.name)];
    return (
      <div className={styles.section}>
        <p className={styles.sectionHeading}>
          {skipped ? 'Your shopping list' : 'We checked your kitchen'}
        </p>
        <p className={styles.sectionHeading} style={{ marginTop: 'var(--space-sm)' }}>
          You already have
        </p>
        {haveChips.length === 0 ? (
          <p className={styles.emptyText}>
            {skipped
              ? 'You skipped the fridge check, so everything below is listed as needed.'
              : 'Nothing matched from your fridge for this recipe.'}
          </p>
        ) : (
          <div className={styles.chipWrap}>
            {haveChips.map((name) => (
              <span key={name} className={styles.chip}>
                ✓ {name}
                {manualHave.some((m) => m.name === name) ? (
                  <button
                    type="button"
                    onClick={() => removeManualHave(name)}
                    aria-label={`Remove ${name}`}
                    style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    ✕
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        )}

        <div className={styles.addRow} style={{ marginTop: 'var(--space-sm)' }}>
          <input
            className={styles.addInput}
            type="text"
            placeholder="＋ I also have… (e.g. crayfish)"
            value={manualDraft}
            onChange={(e) => setManualDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addManualHave();
            }}
          />
          <button type="button" className={styles.addButton} onClick={addManualHave} disabled={!manualDraft.trim()}>
            Add
          </button>
        </div>

        <p className={styles.sectionHeading} style={{ marginTop: 'var(--space-md)' }}>
          You need to buy
        </p>
        {need.length === 0 ? (
          <p className={styles.emptyText}>You&apos;re all set — nothing else to buy.</p>
        ) : (
          <>
            <p className={styles.emptyText}>Tick each item off once you have it, to unlock Start Cooking.</p>
            <div className={styles.chipWrap}>
              {need.map((n) => {
                const checked = purchased.has(n.name);
                return (
                  <button
                    key={n.name}
                    type="button"
                    className={`${styles.chip} ${checked ? styles.chipSelected : ''}`}
                    onClick={() => togglePurchased(n.name)}
                    aria-pressed={checked}
                  >
                    {checked ? '✓' : '○'} {n.name}
                    {n.note ? ` — ${n.note}` : ''}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={addToShoppingList}
                disabled={addingToList || listAdded}
              >
                {listAdded ? '✓ Added to Shopping List' : addingToList ? 'Adding…' : 'Add to Shopping List'}
              </button>
              {listAdded && listId ? (
                <Link href={`/shopping-list/${listId}`} className={styles.secondaryButton}>
                  View shopping list
                </Link>
              ) : null}
            </div>
            {listError ? <p className={styles.errorText}>{listError}</p> : null}
            {need.length > purchased.size ? (
              <p className={styles.emptyText} style={{ marginTop: 'var(--space-sm)' }}>
                {need.length - purchased.size} item{need.length - purchased.size === 1 ? '' : 's'} left to tick off
                before you can start cooking.
              </p>
            ) : null}
          </>
        )}

        <div style={{ marginTop: 'var(--space-md)' }}>{scanAgainButton}</div>
        {rescanFailed ? (
          <p className={styles.errorText}>
            We couldn&apos;t complete the new scan. Your previous kitchen check is still here — try again, or carry on
            with it.
          </p>
        ) : null}
      </div>
    );
  }

  if (stage === 'reviewScan') {
    const toReview = scannedItems.length;
    const kept = scannedItems.filter((i) => selected.has(i.name)).length;
    return (
      <div className={styles.section}>
        <p className={styles.sectionHeading}>Found in your photo</p>
        <p className={styles.emptyText}>
          {kept} of {toReview} kept — tap to keep or drop each, then Confirm.
        </p>
        <div className={styles.chipWrap}>
          {scannedItems.map((item) => (
            <button
              key={item.name}
              type="button"
              className={`${styles.chip} ${selected.has(item.name) ? styles.chipSelected : ''}`}
              onClick={() => toggleSelected(item.name)}
              aria-pressed={selected.has(item.name)}
            >
              {selected.has(item.name) ? '✓' : '○'} {item.name}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <button type="button" className={styles.primaryButton} onClick={confirmScan} disabled={selected.size === 0}>
            Confirm
          </button>
          {scanAgainButton}
        </div>
        {rescanFailed ? (
          <p className={styles.errorText}>We couldn&apos;t complete the new scan. Your previous items are still here.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <p className={styles.sectionHeading}>Want to check what you already have?</p>
      <p className={styles.emptyText}>Scan your fridge, or skip to see your full shopping list.</p>
      <div className={styles.tagRow}>
        <label className={styles.secondaryButton} style={{ cursor: 'pointer', display: 'inline-block' }}>
          {scanning ? 'Scanning…' : '📷 Scan My Fridge'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handlePhotoChange}
            disabled={scanning}
            style={{ display: 'none' }}
          />
        </label>
        <button type="button" className={styles.secondaryButton} onClick={skipScan} disabled={scanning}>
          Skip
        </button>
      </div>
      {error ? (
        <p className={styles.errorText}>
          {error} You can still continue without scanning — everything you need is listed above.
        </p>
      ) : null}
    </div>
  );
}
