import { describe, it, expect } from 'vitest';
import { levenshtein, normalizeName, matchNames } from '../utils/nameMatcher';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('returns 1 for single substitution', () => {
    expect(levenshtein('abc', 'abd')).toBe(1);
  });
  it('returns 2 for two edits', () => {
    expect(levenshtein('Mathhew', 'Matthew')).toBe(2);
  });
  it('handles empty string', () => {
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('normalizeName', () => {
  it('lowercases and strips whitespace', () => {
    expect(normalizeName('  Abunio, Hailey  ')).toBe('abunio, hailey');
  });
  it('collapses multiple spaces', () => {
    expect(normalizeName('Abunio,  Hailey')).toBe('abunio, hailey');
  });
});

describe('matchNames', () => {
  const students = [
    { id: 's1', fullName: 'Abunio, Hailey' },
    { id: 's2', fullName: 'Borja, Reuben Matthew' },
    { id: 's3', fullName: 'Smith, John' },
  ];

  it('finds exact match', () => {
    const res = matchNames(['Abunio, Hailey'], students);
    expect(res[0].status).toBe('exact');
    expect(res[0].studentId).toBe('s1');
  });

  it('finds fuzzy match within 3 edits', () => {
    const res = matchNames(['Borja, Reuben Mathhew'], students);
    expect(res[0].status).toBe('fuzzy');
    expect(res[0].suggestedName).toBe('Borja, Reuben Matthew');
  });

  it('returns unmatched when no match within distance', () => {
    const res = matchNames(['Unknown, Person'], students);
    expect(res[0].status).toBe('unmatched');
  });
});
