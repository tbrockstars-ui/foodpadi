import { classifyVenue, resolveSignal } from './local-food-search.service';

describe('resolveSignal', () => {
  it('maps West African dish names to the West African signal', () => {
    for (const q of ['jollof rice', 'Egusi soup with pounded yam', 'suya', 'amala and ewedu', 'fufu']) {
      expect(resolveSignal(q)?.label).toBe('West African food');
    }
  });

  it('maps common UK requests to their signals', () => {
    expect(resolveSignal('fish and chips')?.label).toBe('Fish & chips');
    expect(resolveSignal('a chippy near me')?.label).toBe('Fish & chips');
    expect(resolveSignal('peri peri chicken')?.label).toBe('Peri-peri chicken');
    expect(resolveSignal('nandos')?.label).toBe('Peri-peri chicken');
    expect(resolveSignal('sushi')?.label).toBe('Sushi');
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveSignal('quinoa buddha bowl')).toBeUndefined();
  });
});

describe('classifyVenue', () => {
  const westAfrican = resolveSignal('jollof rice');

  it('marks a structured cuisine tag as an exact match', () => {
    expect(classifyVenue({ name: 'Enish', cuisine: 'nigerian' }, 'jollof rice', ['jollof'], westAfrican)).toEqual({
      matchType: 'EXACT_MATCH',
      matchedFood: 'West African food',
    });
  });

  it('treats a continent-level cuisine=african tag as a close match, never exact', () => {
    expect(classifyVenue({ name: 'Le Garrick', cuisine: 'african' }, 'jollof rice', ['jollof'], westAfrican)).toEqual({
      matchType: 'CLOSE_MATCH',
      matchedFood: 'West African food',
    });
  });

  it('matches a distinctive dish word in the business name as a close match', () => {
    expect(classifyVenue({ name: 'Presidential Suya' }, 'suya', ['suya'], resolveSignal('suya'))).toEqual({
      matchType: 'CLOSE_MATCH',
      matchedFood: 'West African food',
    });
  });

  it('only matches a name keyword on a word boundary ("garri" must not hit "Le Garrick")', () => {
    // "Le Garrick" is a French restaurant; "garri" (cassava flour) is a West
    // African signal keyword but only as a whole word.
    expect(classifyVenue({ name: 'Le Garrick', cuisine: 'french' }, 'jollof rice', ['jollof'], westAfrican)).toBeNull();
  });

  it('matches shop=chip_shop as an exact fish & chips match even with no cuisine tag', () => {
    expect(
      classifyVenue({ name: "Poppie's", shop: 'chip_shop' }, 'fish and chips', ['fish', 'chips'], resolveSignal('fish and chips')),
    ).toEqual({ matchType: 'EXACT_MATCH', matchedFood: 'Fish & chips' });
  });

  it('does NOT match a query token against the business name ("soup" in "Ducksoup")', () => {
    // No signal for "egusi soup" tokens here; "soup" is a stopword so it is
    // never even a token, and "egusi" must not hit the Vietnamese place.
    expect(
      classifyVenue({ name: 'Ducksoup', cuisine: 'vietnamese' }, 'egusi soup', ['egusi'], undefined),
    ).toBeNull();
  });

  it('drops a nearby venue with no supporting tags at all', () => {
    expect(classifyVenue({ name: 'Some Pub', amenity: 'pub' }, 'sushi', ['sushi'], resolveSignal('sushi'))).toBeNull();
  });

  it('falls back to a raw query token found in the cuisine tag (close match)', () => {
    expect(classifyVenue({ name: 'Common Room', cuisine: 'bowls' }, 'buddha bowl', ['buddha', 'bowl'], undefined)).toEqual({
      matchType: 'CLOSE_MATCH',
      matchedFood: 'Bowls',
    });
  });
});
