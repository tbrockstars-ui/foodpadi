'use client';

/**
 * Frequency control for the guest → free-account conversion prompts on web
 * (guest-mode brief §13). sessionStorage keeps it to "once per visit" without
 * a cookie or a dependency; every access is wrapped since some browsers throw
 * on storage access in private mode.
 */
const KEY = (name: string) => `fp.guestPrompt.${name}`;

export const guestPrompts = {
  hasSeen(name: string): boolean {
    try {
      return sessionStorage.getItem(KEY(name)) === '1';
    } catch {
      return false;
    }
  },
  markSeen(name: string): void {
    try {
      sessionStorage.setItem(KEY(name), '1');
    } catch {
      /* ignore */
    }
  },
  bumpCount(name: string): number {
    try {
      const next = this.getCount(name) + 1;
      sessionStorage.setItem(`${KEY(name)}.count`, String(next));
      return next;
    } catch {
      return 0;
    }
  },
  getCount(name: string): number {
    try {
      const n = Number(sessionStorage.getItem(`${KEY(name)}.count`));
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  },
};
