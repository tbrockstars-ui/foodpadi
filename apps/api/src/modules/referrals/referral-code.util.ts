import * as crypto from 'crypto';

// No 0/O/1/I/L — a code read off a screen, dictated over the phone, or typed
// from a WhatsApp message shouldn't get mangled.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const DEFAULT_LENGTH = 7;
const MIN_LENGTH = 4;
const MAX_LENGTH = 16;

/** Configurable via REFERRAL_CODE_LENGTH; clamped to a sane range. */
export function referralCodeLength(): number {
  const n = Number(process.env.REFERRAL_CODE_LENGTH);
  return Number.isInteger(n) && n >= MIN_LENGTH && n <= MAX_LENGTH ? n : DEFAULT_LENGTH;
}

export function generateReferralCode(length = referralCodeLength()): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * Canonical form for lookup — codes are case-insensitive and whitespace is
 * ignored, so "k7r px q2" and "K7RPXQ2" resolve to the same referrer.
 */
export function normaliseReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}
