import { describe, it, expect } from 'vitest';
import { getLastNSundays, computeConsecutiveStreak, sundaysInMonth } from '../utils/sundayStreak';

describe('getLastNSundays', () => {
  it('returns 4 most recent Sundays walking backwards from Wed Apr 22 2026', () => {
    // Apr 22 2026 is Wed. Prior Sundays: Apr 19, Apr 12, Apr 5, Mar 29
    const from = new Date('2026-04-22T12:00:00Z');
    const result = getLastNSundays(from, 4);
    expect(result).toEqual(['2026-04-19', '2026-04-12', '2026-04-05', '2026-03-29']);
  });

  it('when from is Sunday, includes that Sunday', () => {
    const from = new Date('2026-04-19T12:00:00Z'); // Sunday
    const result = getLastNSundays(from, 2);
    expect(result).toEqual(['2026-04-19', '2026-04-12']);
  });
});

describe('computeConsecutiveStreak', () => {
  const from = new Date('2026-04-22T12:00:00Z');

  it('returns 4 when all 4 Sundays attended', () => {
    const attended = ['2026-04-19', '2026-04-12', '2026-04-05', '2026-03-29'];
    expect(computeConsecutiveStreak(attended, from, 4)).toBe(4);
  });

  it('returns 2 when streak breaks after 2', () => {
    const attended = ['2026-04-19', '2026-04-12']; // skipped Apr 5, Mar 29
    expect(computeConsecutiveStreak(attended, from, 4)).toBe(2);
  });

  it('returns 0 when most recent Sunday not attended', () => {
    const attended = ['2026-04-12', '2026-04-05'];
    expect(computeConsecutiveStreak(attended, from, 4)).toBe(0);
  });

  it('counts extra dates as ignored', () => {
    const attended = ['2026-04-19', '2026-04-12', '2026-04-05', '2026-03-29', '2026-03-22'];
    expect(computeConsecutiveStreak(attended, from, 4)).toBe(4);
  });
});

describe('sundaysInMonth', () => {
  it('returns 4 Sundays for April 2026', () => {
    // April 2026: 5, 12, 19, 26 = 4 Sundays
    expect(sundaysInMonth(2026, 4)).toEqual(['2026-04-05', '2026-04-12', '2026-04-19', '2026-04-26']);
  });

  it('returns 5 Sundays for March 2026', () => {
    // March 2026: 1, 8, 15, 22, 29 = 5 Sundays
    expect(sundaysInMonth(2026, 3).length).toBe(5);
  });
});
