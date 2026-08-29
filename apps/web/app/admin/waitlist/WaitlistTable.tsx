'use client';

import { useState } from 'react';
import type { AdminWaitlistListResponse } from './types';
import styles from './waitlist.module.css';

interface Props {
  initial: AdminWaitlistListResponse;
}

const PAGE_SIZE = 25;

export function WaitlistTable({ initial }: Props) {
  const [result, setResult] = useState(initial);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = async (search: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin-proxy/admin/waitlist?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load the waitlist.');
      const data: AdminWaitlistListResponse = await res.json();
      setResult(data);
    } catch {
      setError('Something went wrong loading the waitlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPage(searchInput.trim(), 1);
  };

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div>
      <form className={styles.searchRow} onSubmit={search}>
        <input
          className={styles.searchInput}
          placeholder="Search by email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className={styles.searchButton} type="submit" disabled={loading}>
          Search
        </button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {result.signups.length === 0 ? (
              <tr>
                <td colSpan={2} className={styles.emptyRow}>
                  No signups yet.
                </td>
              </tr>
            ) : (
              result.signups.map((signup) => (
                <tr key={signup.id}>
                  <td>{signup.email}</td>
                  <td>{new Date(signup.createdAt).toLocaleDateString('en-GB')}</td>
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
          Page {result.page} of {totalPages} · {result.total} signup{result.total === 1 ? '' : 's'}
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
