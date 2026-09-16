import { dealerMissingFields, scoreDealerCompleteness } from './dealer-completeness';
import { normaliseTerm, singularise, slugifyName, tokenise } from './dealer-taxonomy';

describe('scoreDealerCompleteness', () => {
  it('an empty profile scores 0', () => {
    expect(scoreDealerCompleteness({})).toBe(0);
  });

  it('a fully filled profile scores 100', () => {
    expect(
      scoreDealerCompleteness({
        name: "Mama's African Foods",
        description: 'Nigerian groceries and prepared food in Leicester.',
        dealerType: 'african_food_store',
        phone: '0116 555 0100',
        openingHours: { mon: '09:00-18:00' },
        categories: ['African Food', 'Nigerian Food'],
        cuisines: ['Nigerian'],
        locationCount: 1,
        productCount: 5,
      }),
    ).toBe(100);
  });

  it('is monotonic — adding a satisfied field never lowers the score', () => {
    const base = { name: 'X', dealerType: 'restaurant' as const };
    const withLoc = scoreDealerCompleteness({ ...base, locationCount: 1 });
    const withLocAndProduct = scoreDealerCompleteness({ ...base, locationCount: 1, productCount: 2 });
    expect(withLoc).toBeGreaterThan(scoreDealerCompleteness(base));
    expect(withLocAndProduct).toBeGreaterThan(withLoc);
  });

  it('a contact via any single channel counts (phone OR website OR order OR whatsapp)', () => {
    const a = scoreDealerCompleteness({ name: 'X', phone: '123' });
    const b = scoreDealerCompleteness({ name: 'X', websiteUrl: 'https://x.example' });
    const c = scoreDealerCompleteness({ name: 'X', whatsapp: '+2348000000000' });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('dealerMissingFields', () => {
  it('a blank profile is missing every hard field', () => {
    const { hardMissing } = dealerMissingFields({});
    expect(hardMissing).toEqual(
      expect.arrayContaining(['Business name', 'Business type', 'At least one location']),
    );
  });

  it('categories alone satisfy the "product or category" hard requirement', () => {
    const { hardMissing } = dealerMissingFields({
      name: 'X',
      dealerType: 'grocery_dealer',
      phone: '123',
      locationCount: 1,
      categories: ['African groceries'],
      productCount: 0,
    });
    expect(hardMissing).toHaveLength(0);
  });

  it('description / cuisines / hours are only soft-missing, never blocking', () => {
    const { hardMissing, softMissing } = dealerMissingFields({
      name: 'X',
      dealerType: 'restaurant',
      phone: '123',
      locationCount: 1,
      productCount: 1,
    });
    expect(hardMissing).toHaveLength(0);
    expect(softMissing).toEqual(
      expect.arrayContaining(['Business description', 'Cuisines', 'Opening hours']),
    );
  });
});

describe('dealer-taxonomy helpers', () => {
  it('normaliseTerm folds case, accents and punctuation', () => {
    expect(normaliseTerm('  Egúsi Soup! ')).toBe('egusi soup');
    expect(normaliseTerm('Jollof-Rice')).toBe('jollof rice');
  });

  it('tokenise drops stopwords and short tokens', () => {
    expect(tokenise('where can I buy egusi near me')).toEqual(['egusi']);
    expect(tokenise('Nigerian food shop')).toEqual(['nigerian']);
  });

  it('singularise folds common plurals', () => {
    expect(singularise('groceries')).toBe('grocery');
    expect(singularise('tomatoes')).toBe('tomato');
    expect(singularise('spices')).toBe('spice');
    expect(singularise('rice')).toBe('rice');
  });

  it('slugifyName produces a stable kebab slug', () => {
    expect(slugifyName("Mama's African Foods")).toBe('mamas-african-foods');
  });
});
