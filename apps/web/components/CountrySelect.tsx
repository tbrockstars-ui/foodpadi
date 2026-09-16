'use client';

import { useEffect, useState } from 'react';
import { COUNTRY_OPTIONS, countryName } from '@foodpadi/shared';

/**
 * Country-of-residence picker used by the registration form and the paywall's
 * country prompt. A plain <select> so it works with the surrounding form; the
 * caller supplies the className so it matches whichever form it sits in.
 */
export function CountrySelect({
  value,
  onChange,
  className,
  id,
  required,
  includeBlank = true,
  blankLabel = 'Select your country…',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
  includeBlank?: boolean;
  blankLabel?: string;
  'aria-label'?: string;
}) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      required={required}
      aria-label={ariaLabel ?? 'Country of residence'}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeBlank ? <option value="">{blankLabel}</option> : null}
      {COUNTRY_OPTIONS.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/** Best-guess ISO country from the browser locale, e.g. "en-GB" -> "GB". */
export function guessCountryFromBrowser(): string {
  if (typeof navigator === 'undefined') return '';
  for (const tag of navigator.languages ?? [navigator.language]) {
    try {
      const region = new Intl.Locale(tag).region;
      if (region && COUNTRY_OPTIONS.some((c) => c.code === region)) return region;
    } catch {
      /* ignore malformed tag */
    }
  }
  return '';
}

/** ISO alpha-2 -> flag emoji (two regional-indicator symbols), or '' if invalid. */
export function flagEmoji(code: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/**
 * A small "we think you're here" line with the country flag, shown on the
 * login page before sign-in. Detected from the browser locale only — it's a
 * hint, not confirmed. Renders nothing when the region can't be resolved.
 */
export function CountryFlagHint({ className }: { className?: string }) {
  const [code, setCode] = useState('');
  useEffect(() => {
    setCode(guessCountryFromBrowser());
  }, []);
  if (!code) return null;
  return (
    <p className={className}>
      <span aria-hidden="true">{flagEmoji(code)}</span> Signing in from {countryName(code)}
    </p>
  );
}
