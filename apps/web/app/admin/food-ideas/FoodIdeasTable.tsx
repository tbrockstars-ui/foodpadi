'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminFoodIdeaListResponse } from './types';
import styles from './food-ideas.module.css';

const PAGE_SIZE = 25;

export function FoodIdeasTable({ initial }: { initial: AdminFoodIdeaListResponse }) {
  const [result, setResult] = useState(initial);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const fetchPage = async (search: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin-proxy/admin/food-ideas?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load food ideas.');
      const data: AdminFoodIdeaListResponse = await res.json();
      setResult(data);
    } catch {
      setError('Something went wrong loading food ideas. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPage(searchInput.trim(), 1);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin-proxy/admin/food-ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === id ? { ...item, isActive: !isActive } : item)),
      }));
    } catch {
      setError("Couldn't update that food idea. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin-proxy/admin/food-ideas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setResult((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== id),
        total: current.total - 1,
      }));
      setConfirmingDeleteId(null);
    } catch {
      setError("Couldn't delete that food idea. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div>
      <form className={styles.searchRow} onSubmit={search}>
        <input
          className={styles.searchInput}
          placeholder="Search by title, cuisine, or slug"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className={styles.searchButton} type="submit" disabled={loading}>
          Search
        </button>
        <Link href="/admin/food-ideas/new" className={styles.addButton}>
          + Add food idea
        </Link>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Cuisine</th>
              <th>Budget</th>
              <th>Tags</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyRow}>
                  No food ideas match that search.
                </td>
              </tr>
            ) : (
              result.items.map((item) => (
                <tr key={item.id} className={item.isActive ? undefined : styles.inactiveRow}>
                  <td>
                    <strong>{item.title}</strong>
                    <br />
                    <span style={{ color: 'var(--text-faint, #9a9e94)', fontSize: 12 }}>{item.slug}</span>
                  </td>
                  <td>{item.cuisine}</td>
                  <td>{item.budgetTier}</td>
                  <td>
                    {item.tags.map((tag) => (
                      <span key={tag} className={styles.tagPill}>
                        {tag}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${item.isActive ? styles.statusActive : styles.statusInactive}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link href={`/admin/food-ideas/${item.id}`} className={styles.rowActionLink}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className={styles.rowActionButton}
                        onClick={() => toggleActive(item.id, item.isActive)}
                        disabled={busyId === item.id}
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {confirmingDeleteId === item.id ? (
                        <>
                          <button
                            type="button"
                            className={styles.rowActionButtonDanger}
                            onClick={() => remove(item.id)}
                            disabled={busyId === item.id}
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            className={styles.rowActionButton}
                            onClick={() => setConfirmingDeleteId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={styles.rowActionButtonDanger}
                          onClick={() => setConfirmingDeleteId(item.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button
          className={styles.pageButton}
          type="button"
          disabled={result.page <= 1 || loading}
          onClick={() => fetchPage(searchInput.trim(), result.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {result.page} of {totalPages} · {result.total} food idea{result.total === 1 ? '' : 's'}
        </span>
        <button
          className={styles.pageButton}
          type="button"
          disabled={result.page >= totalPages || loading}
          onClick={() => fetchPage(searchInput.trim(), result.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
