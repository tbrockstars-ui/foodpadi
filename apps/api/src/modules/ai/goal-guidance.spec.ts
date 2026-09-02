import { goalGuidanceLine } from './goal-guidance';

describe('goalGuidanceLine', () => {
  it('returns null when there are no goals', () => {
    expect(goalGuidanceLine({ goalTypes: [] })).toBeNull();
  });

  it('returns null when the only goal is "none"', () => {
    expect(goalGuidanceLine({ goalTypes: ['none'] })).toBeNull();
  });

  it('turns mapped goals into one soft-preference sentence', () => {
    const line = goalGuidanceLine({ goalTypes: ['reduce_spending', 'balanced_meals'] });
    expect(line).toContain('inexpensive');
    expect(line).toContain('balanced plates');
    expect(line).toContain('soft preferences, not hard rules');
  });

  it('never frames guidance as health/medical/weight-loss', () => {
    const line = goalGuidanceLine({ goalTypes: ['maintain_weight', 'support_fitness'] });
    expect(line).toMatch(/never frame a dish as healthy, medical, or weight-loss related/);
    expect(line).not.toMatch(/lose weight|calorie|diet\b/i);
  });

  it('includes the personal note verbatim when "personal" is selected', () => {
    const line = goalGuidanceLine({
      goalTypes: ['personal'],
      personalNote: 'cooking for a toddler',
    });
    expect(line).toContain('cooking for a toddler');
  });

  it('ignores an empty/whitespace personal note', () => {
    expect(goalGuidanceLine({ goalTypes: ['personal'], personalNote: '   ' })).toBeNull();
  });
});
