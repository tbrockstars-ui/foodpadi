import { routeFoodDecision } from './foodDecisionRouter';

describe('routeFoodDecision', () => {
  it('routes "Quick" to Eat Now with a matching query', () => {
    const target = routeFoodDecision(['quick']);
    expect(target).toEqual({ engine: 'eat-now', query: 'quick', maxPricePence: undefined });
  });

  it('routes "Use what I have" to Cook Today', () => {
    expect(routeFoodDecision(['use-what-i-have'])).toEqual({ engine: 'cook-today' });
  });

  it('routes "Family" to Cook Today', () => {
    expect(routeFoodDecision(['family'])).toEqual({ engine: 'cook-today' });
  });

  it('routes "Something different" to Eat Now', () => {
    const target = routeFoodDecision(['something-different']);
    expect(target).toEqual({ engine: 'eat-now', query: 'different', maxPricePence: undefined });
  });

  it('combines "Quick" + "Filling" into one Eat Now query', () => {
    const target = routeFoodDecision(['quick', 'filling']);
    expect(target).toEqual({ engine: 'eat-now', query: 'quick filling', maxPricePence: undefined });
  });

  it('turns "Cheap" into a price filter, not a keyword (no catalog entry contains the word)', () => {
    const target = routeFoodDecision(['cheap']);
    expect(target).toEqual({ engine: 'eat-now', query: 'anything', maxPricePence: 800 });
  });

  it('prioritises Cook Today when combined with an Eat Now-style chip', () => {
    expect(routeFoodDecision(['quick', 'family'])).toEqual({ engine: 'cook-today' });
  });

  it('falls back to a surprise-me query if no chip is selected', () => {
    const target = routeFoodDecision([]);
    expect(target).toEqual({ engine: 'eat-now', query: 'anything', maxPricePence: undefined });
  });
});
