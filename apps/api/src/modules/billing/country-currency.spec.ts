import { countryFromAcceptLanguage, currencyForCountry } from './country-currency';

describe('currencyForCountry', () => {
  it('maps UK and Eurozone', () => {
    expect(currencyForCountry('GB')).toBe('gbp');
    expect(currencyForCountry('gb')).toBe('gbp');
    expect(currencyForCountry('DE')).toBe('eur');
    expect(currencyForCountry('FR')).toBe('eur');
  });

  it('maps Nigeria to ngn (the currency_options lookup then misses → USD fallback)', () => {
    expect(currencyForCountry('NG')).toBe('ngn');
  });

  it('returns null for unknown / empty', () => {
    expect(currencyForCountry('ZZ')).toBeNull();
    expect(currencyForCountry('')).toBeNull();
    expect(currencyForCountry(null)).toBeNull();
    expect(currencyForCountry(undefined)).toBeNull();
  });
});

describe('countryFromAcceptLanguage', () => {
  it('extracts the region from the first tag that has one', () => {
    expect(countryFromAcceptLanguage('en-GB,en;q=0.9')).toBe('GB');
    expect(countryFromAcceptLanguage('fr-FR,fr;q=0.8,en;q=0.5')).toBe('FR');
    expect(countryFromAcceptLanguage('en;q=0.9,de-DE')).toBe('DE');
  });

  it('returns null when no region is present', () => {
    expect(countryFromAcceptLanguage('en,fr')).toBeNull();
    expect(countryFromAcceptLanguage('')).toBeNull();
    expect(countryFromAcceptLanguage(undefined)).toBeNull();
  });
});
