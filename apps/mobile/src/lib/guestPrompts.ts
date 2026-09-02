import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Frequency control for the guest → free-account conversion prompts
 * (guest-mode brief §13: "Once a guest sees a particular conversion prompt,
 * do not immediately show the same prompt again"). Deliberately reuses the
 * same storage mechanism as tokenStore rather than pulling in a new
 * dependency — these flags aren't sensitive, they just need to survive an
 * app restart within a guest session and be wiped on conversion.
 *
 * SecureStore has no "list keys" call, so `clearAll` iterates a fixed key
 * list. Add new prompt keys to PROMPT_KEYS.
 */
export const PROMPT_KEYS = [
  'home_benefit',
  'cook_results',
  'decide_options',
  'plan_preview',
  'eat_now_hint',
] as const;

export type GuestPromptKey = (typeof PROMPT_KEYS)[number];

const isWeb = Platform.OS === 'web';
const seenKey = (k: GuestPromptKey) => `foodpadi.guestPrompt.seen.${k}`;
const countKey = (k: GuestPromptKey) => `foodpadi.guestPrompt.count.${k}`;

async function getItem(key: string): Promise<string | null> {
  return isWeb ? localStorage.getItem(key) : SecureStore.getItemAsync(key);
}
async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const guestPrompts = {
  async hasSeen(key: GuestPromptKey): Promise<boolean> {
    return (await getItem(seenKey(key))) === '1';
  },
  async markSeen(key: GuestPromptKey): Promise<void> {
    await setItem(seenKey(key), '1');
  },
  async getCount(key: GuestPromptKey): Promise<number> {
    const raw = await getItem(countKey(key));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  },
  /** Increments the view counter for `key` and returns the new total. */
  async bumpCount(key: GuestPromptKey): Promise<number> {
    const next = (await guestPrompts.getCount(key)) + 1;
    await setItem(countKey(key), String(next));
    return next;
  },
  /** Wipe every guest-prompt flag — called on guest → account conversion. */
  async clearAll(): Promise<void> {
    await Promise.all(
      PROMPT_KEYS.flatMap((k) => [removeItem(seenKey(k)), removeItem(countKey(k))]),
    );
  },
};
