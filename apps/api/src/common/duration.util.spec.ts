import { parseDurationMs } from './duration.util';

describe('parseDurationMs', () => {
  it('parses seconds, minutes, hours, days', () => {
    expect(parseDurationMs('30s')).toBe(30 * 1000);
    expect(parseDurationMs('15m')).toBe(15 * 60 * 1000);
    expect(parseDurationMs('2h')).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('throws on an invalid duration string', () => {
    expect(() => parseDurationMs('not-a-duration')).toThrow();
    expect(() => parseDurationMs('30')).toThrow();
    expect(() => parseDurationMs('30x')).toThrow();
  });
});
