// ISO 3166-1 alpha-2 country -> ISO 4217 currency (lowercase, Stripe style).
//
// This is a static LOOKUP used only to decide which of the Stripe Price's
// `currency_options` entries to SHOW as a pre-checkout estimate. It is not an
// exchange rate and is never used to compute a charge. Any country not listed
// here — or listed but with no matching entry in the Price's currency_options
// (e.g. NGN, which Stripe cannot present) — falls back to USD in the UI, which
// is exactly the graceful degradation the product requires.
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GB: 'gbp',
  US: 'usd',
  CA: 'cad',
  AU: 'aud',
  NZ: 'nzd',
  CH: 'chf',
  SE: 'sek',
  NO: 'nok',
  DK: 'dkk',
  PL: 'pln',
  CZ: 'czk',
  HU: 'huf',
  RO: 'ron',
  BG: 'bgn',
  // Stripe-supported merchant countries outside Europe. A local presentment
  // amount only shows when the currency is also in BillingConfig.currencyOptions
  // (seeded from DEFAULT_CURRENCY_OPTIONS, editable in the admin dashboard) —
  // otherwise the customer sees USD, which is always valid.
  SG: 'sgd',
  HK: 'hkd',
  JP: 'jpy',
  AE: 'aed',
  MY: 'myr',
  TH: 'thb',
  ID: 'idr',
  PH: 'php',
  IN: 'inr',
  BR: 'brl',
  MX: 'mxn',
  ZA: 'zar',
  // Eurozone
  AT: 'eur',
  BE: 'eur',
  HR: 'eur',
  CY: 'eur',
  EE: 'eur',
  FI: 'eur',
  FR: 'eur',
  DE: 'eur',
  GR: 'eur',
  IE: 'eur',
  IT: 'eur',
  LV: 'eur',
  LT: 'eur',
  LU: 'eur',
  MT: 'eur',
  NL: 'eur',
  PT: 'eur',
  SK: 'eur',
  SI: 'eur',
  ES: 'eur',
  // Targeted markets Stripe generally cannot present a local currency for —
  // mapped so the intent is explicit; the currency_options lookup will miss
  // and the UI will fall back to USD.
  NG: 'ngn',
  GH: 'ghs',
  KE: 'kes',
};

export function currencyForCountry(country?: string | null): string | null {
  if (!country) return null;
  return COUNTRY_TO_CURRENCY[country.trim().toUpperCase()] ?? null;
}

// Countries whose billing is routed to Flutterwave instead of Stripe (native
// local currency, local payment methods). Nigeria only for now — Stripe cannot
// present NGN and Nigeria is not a supported Stripe merchant country. Extend
// deliberately (GH/KE) once each is verified end to end.
export const FLUTTERWAVE_COUNTRIES = new Set(['NG']);

export function isFlutterwaveCountry(country?: string | null): boolean {
  if (!country) return false;
  return FLUTTERWAVE_COUNTRIES.has(country.trim().toUpperCase());
}

/**
 * Best-guess ISO country from an `Accept-Language` header, e.g.
 * "en-GB,en;q=0.9" -> "GB". A hint for the pre-checkout estimate only —
 * browser locale does not prove payment country, so Stripe Checkout remains
 * authoritative for the real charge.
 */
export function countryFromAcceptLanguage(header?: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim(); // "en-GB"
    const match = /^[a-zA-Z]{2,3}-([A-Za-z]{2})$/.exec(tag);
    if (match) return match[1].toUpperCase();
  }
  return null;
}
