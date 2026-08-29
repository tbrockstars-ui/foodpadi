'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminUserListResponse } from './types';
import styles from './users.module.css';

interface Props {
  initial: AdminUserListResponse;
}

const PAGE_SIZE = 25;

export function UsersTable({ initial }: Props) {
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
      const res = await fetch(`/api/admin-proxy/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load users.');
      const data: AdminUserListResponse = await res.json();
      setResult(data);
    } catch {
      setError('Something went wrong loading users. Please try again.');
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
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {result.users.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.emptyRow}>
                  No users found.
                </td>
              </tr>
            ) : (
              result.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link href={`/admin/users/${user.id}`} className={styles.emailLink}>
                      {user.email}
                    </Link>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${user.suspended ? styles.badgeSuspended : styles.badgeActive}`}>
                      {user.suspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString('en-GB')}</td>
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
          Page {result.page} of {totalPages} · {result.total} user{result.total === 1 ? '' : 's'}
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
