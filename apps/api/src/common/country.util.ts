/** Uppercase a 2-letter ISO 3166-1 alpha-2 country code, or null for anything else. */
export function normaliseCountryCode(input?: string | null): string | null {
  if (!input) return null;
  const code = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}
