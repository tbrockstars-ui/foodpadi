import { buildFoodImageQuery, normaliseFoodKey } from './food-image-query';
import { pickBestPhoto } from './food-image-relevance';
import type { ProviderPhoto } from './providers/food-image-provider';

describe('normaliseFoodKey', () => {
  it('lowercases, expands &, strips punctuation and parentheticals', () => {
    expect(normaliseFoodKey('Fish & Chips')).toBe('fish and chips');
    expect(normaliseFoodKey("Shepherd's pie")).toBe('shepherd s pie');
    expect(normaliseFoodKey('Jacket potato (with beans)')).toBe('jacket potato');
    expect(normaliseFoodKey('  Chicken   Biryani  ')).toBe('chicken biryani');
  });
});

describe('buildFoodImageQuery', () => {
  it('produces a tight food-specific query, not a broad one (brief §28)', () => {
    expect(buildFoodImageQuery('Chicken Biryani')).toBe('chicken biryani indian food');
    expect(buildFoodImageQuery('Fish & Chips')).toBe('fish and chips food');
    expect(buildFoodImageQuery('Vegetable Stir Fry')).toBe('vegetable stir fry food');
  });

  it('anchors culturally-ambiguous dishes to a cuisine (brief §29)', () => {
    expect(buildFoodImageQuery('Jollof rice with chicken')).toContain('nigerian');
    expect(buildFoodImageQuery('Chicken biryani')).toContain('indian');
  });

  it('uses an explicit cuisine (first word only) instead of the built-in hint', () => {
    expect(buildFoodImageQuery('Jollof rice', 'Nigerian & West African')).toBe('jollof rice nigerian food');
  });

  it('drops filler words and never doubles the "food" suffix', () => {
    expect(buildFoodImageQuery('A big bowl of ramen')).toBe('ramen japanese food');
    expect(buildFoodImageQuery('Street food tacos')).toBe('street food tacos');
  });
});

function photo(over: Partial<ProviderPhoto>): ProviderPhoto {
  return {
    id: '1',
    imageUrl: 'https://cdn.example/large.jpg',
    thumbnailUrl: 'https://cdn.example/medium.jpg',
    description: '',
    photographer: 'Test',
    photographerUrl: null,
    sourceUrl: 'https://example/photo',
    width: 1200,
    height: 800,
    downloadLocation: null,
    ...over,
  };
}

describe('pickBestPhoto', () => {
  it('returns null when every candidate is rejected', () => {
    expect(pickBestPhoto([], 'chicken biryani')).toBeNull();
    expect(
      pickBestPhoto([photo({ description: 'a woman eating at a restaurant' }), photo({ width: 200 })], 'pizza'),
    ).toBeNull();
  });

  it('prefers the candidate whose alt text matches the distinctive dish words', () => {
    const generic = photo({ id: 'g', description: 'a delicious meal on a wooden table' });
    const match = photo({ id: 'm', description: 'chicken biryani rice with spices' });
    expect(pickBestPhoto([generic, match], 'Chicken Biryani')?.id).toBe('m');
  });

  it('falls back to the provider ordering when no alt text gives a signal', () => {
    const first = photo({ id: 'first', description: '' });
    const second = photo({ id: 'second', description: '' });
    expect(pickBestPhoto([first, second], 'pad thai')?.id).toBe('first');
  });
});
