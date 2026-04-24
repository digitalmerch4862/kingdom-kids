import { describe, it, expect } from 'vitest';
import { getMondayOf, isSameWeek, formatWeekLabel } from '../utils/featuredWeek';

describe('getMondayOf', () => {
  it('returns same day if already Monday', () => {
    expect(getMondayOf(new Date('2026-04-20'))).toBe('2026-04-20');
  });
  it('returns prior Monday for Wednesday', () => {
    expect(getMondayOf(new Date('2026-04-22'))).toBe('2026-04-20');
  });
  it('returns prior Monday for Sunday', () => {
    expect(getMondayOf(new Date('2026-04-26'))).toBe('2026-04-20');
  });
  it('works at year boundary', () => {
    expect(getMondayOf(new Date('2026-01-01'))).toBe('2025-12-29');
  });
});

describe('isSameWeek', () => {
  it('same week → true', () => {
    expect(isSameWeek('2026-04-20', '2026-04-24')).toBe(true);
  });
  it('different week → false', () => {
    expect(isSameWeek('2026-04-20', '2026-04-27')).toBe(false);
  });
  it('monday and sunday of same week → true', () => {
    expect(isSameWeek('2026-04-20', '2026-04-26')).toBe(true);
  });
});

describe('formatWeekLabel', () => {
  it('formats week_start into readable label', () => {
    expect(formatWeekLabel('2026-04-20')).toBe('Apr 20 – Apr 26, 2026');
  });
  it('handles month boundary', () => {
    expect(formatWeekLabel('2026-03-30')).toBe('Mar 30 – Apr 5, 2026');
  });
});
