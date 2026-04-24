import { describe, it, expect } from 'vitest';
import { categorize } from '../utils/idBuckets';

describe('categorize', () => {
  it('NEEDS_REPRINT when idNeedsReprint true (regardless of idIssuedAt)', () => {
    expect(categorize({ idIssuedAt: '2026-01-01T00:00:00Z', idNeedsReprint: true, streak: 4 })).toBe('NEEDS_REPRINT');
  });

  it('HAS_ID when idIssuedAt set and not reprint', () => {
    expect(categorize({ idIssuedAt: '2026-01-01T00:00:00Z', idNeedsReprint: false, streak: 4 })).toBe('HAS_ID');
  });

  it('QUALIFIED when no ID and streak >= minStreak', () => {
    expect(categorize({ idIssuedAt: null, idNeedsReprint: false, streak: 4 })).toBe('QUALIFIED');
  });

  it('NOT_YET when no ID and streak < minStreak', () => {
    expect(categorize({ idIssuedAt: null, idNeedsReprint: false, streak: 3 })).toBe('NOT_YET');
  });
});
