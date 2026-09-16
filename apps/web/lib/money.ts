import type { MoneyView } from '@foodpadi/shared';

// Stripe reports amounts in the currency's minor unit, except for zero-decimal
// currencies where `unit_amount` is already the whole amount. Keep a small list
// so a presentment amount in one of these is not divided by 100.
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

// Currencies that technically have a minor unit but are conventionally shown
// as whole amounts (no ".00"). NGN prices in particular read oddly with kobo.
const WHOLE_AMOUNT_DISPLAY = new Set(['ngn', 'kes', 'ghs', 'tzs', 'zmw']);

/** "$4.99", "£4.49", "₦7,500" — locale-aware, from a { amountCents, currency }. */
export function formatMoney(money: MoneyView, locale?: string): string {
  const code = money.currency.toLowerCase();
  const currency = money.currency.toUpperCase();
  const value = ZERO_DECIMAL.has(code) ? money.amountCents : money.amountCents / 100;
  const fractionless = ZERO_DECIMAL.has(code) || WHOLE_AMOUNT_DISPLAY.has(code);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(fractionless ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    }).format(value);
  } catch {
    // Unknown currency code — fall back to a plain number + code.
    return `${fractionless ? Math.round(value) : value.toFixed(2)} ${currency}`;
  }
}

/** "$4.99/month" */
export function formatPricePerMonth(money: MoneyView, locale?: string): string {
  return `${formatMoney(money, locale)}/month`;
}
