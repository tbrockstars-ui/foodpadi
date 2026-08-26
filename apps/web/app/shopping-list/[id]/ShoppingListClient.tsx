'use client';

import { useState } from 'react';
import { AISLE_ORDER, categorizeIngredient, type ShoppingListItemView, type ShoppingListView } from '@foodpadi/shared';
import styles from '../shopping-list.module.css';

/** Web counterpart to apps/mobile/src/screens/ShoppingListScreen.tsx. */
export function ShoppingListClient({ initialList }: { initialList: ShoppingListView }) {
  const [list, setList] = useState(initialList);
  const [newItem, setNewItem] = useState('');

  const toggle = async (itemId: string, checked: boolean) => {
    setList((current) => ({ ...current, items: current.items.map((i) => (i.id === itemId ? { ...i, checked } : i)) }));
    await fetch(`/api/proxy/plan-ahead/shopping-lists/${list.id}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked }),
    });
  };

  const addItem = async () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setNewItem('');
    const res = await fetch(`/api/proxy/plan-ahead/shopping-lists/${list.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientName: trimmed }),
    });
    // Append from the response rather than router.refresh() — this is a
    // Client Component, so its useState(initialList) only reads that prop
    // once on mount; a refreshed server prop wouldn't resync it.
    const created = (await res.json()) as ShoppingListItemView;
    setList((current) => ({ ...current, items: [...current.items, created] }));
  };

  const removeItem = async (itemId: string) => {
    setList((current) => ({ ...current, items: current.items.filter((i) => i.id !== itemId) }));
    await fetch(`/api/proxy/plan-ahead/shopping-lists/${list.id}/items/${itemId}`, { method: 'DELETE' });
  };

  const remaining = list.items.filter((i) => !i.checked).length;
  const groups = AISLE_ORDER.map((aisle) => ({
    aisle,
    items: list.items.filter((item) => categorizeIngredient(item.ingredientName) === aisle),
  })).filter((group) => group.items.length > 0);

  return (
    <div>
      <h1 className={styles.title}>Shopping list</h1>
      <p className={styles.subtitle}>{remaining === 0 ? 'All done!' : `${remaining} item${remaining === 1 ? '' : 's'} left`}</p>

      {list.items.length === 0 ? (
        <p className={styles.emptyText}>Nothing here yet. Add an item below to get started.</p>
      ) : (
        groups.map((group) => (
          <div key={group.aisle} className={styles.group}>
            <p className={styles.groupHeading}>{group.aisle}</p>
            <div className={styles.card}>
              {group.items.map((item) => (
                <div key={item.id} className={styles.row}>
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={item.checked}
                      onChange={(e) => toggle(item.id, e.target.checked)}
                    />
                    <span className={`${styles.itemText} ${item.checked ? styles.itemTextChecked : ''}`}>
                      {[item.quantity, item.ingredientName].filter(Boolean).join(' ')}
                    </span>
                  </label>
                  <button
                    type="button"
                    className={styles.removeIcon}
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Add an item"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addItem();
          }}
        />
        <button type="button" className={styles.addButton} onClick={addItem}>
          Add
        </button>
      </div>
    </div>
  );
}
