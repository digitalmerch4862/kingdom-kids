import { describe, it, expect } from 'vitest';
import { mapAgeGroup, normalizeDate } from '../utils/excelParser';

describe('mapAgeGroup', () => {
  it('maps "4-6 YRS OLD AND BELOW" to "3-6"', () => {
    expect(mapAgeGroup('4-6 YRS OLD AND BELOW')).toBe('3-6');
  });

  it('maps "7-9 YRS OLD" to "7-9"', () => {
    expect(mapAgeGroup('7-9 YRS OLD')).toBe('7-9');
  });

  it('maps "10-12 YRS OLD" to "10-12"', () => {
    expect(mapAgeGroup('10-12 YRS OLD')).toBe('10-12');
  });

  it('returns "General" for unknown header', () => {
    expect(mapAgeGroup('Adult Class')).toBe('General');
  });
});

describe('normalizeDate', () => {
  it('converts "1/11" to "2026-01-11"', () => {
    expect(normalizeDate('1/11', 2026)).toBe('2026-01-11');
  });

  it('converts "12/27" to "2026-12-27"', () => {
    expect(normalizeDate('12/27', 2026)).toBe('2026-12-27');
  });

  it('pads single-digit month and day', () => {
    expect(normalizeDate('3/8', 2026)).toBe('2026-03-08');
  });
});
