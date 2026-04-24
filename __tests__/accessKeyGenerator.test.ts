import { describe, it, expect } from 'vitest';
import { generateAccessKey, generateBatchAccessKeys } from '../utils/accessKeyGenerator';

describe('generateAccessKey', () => {
  it('returns 2026001 when no existing keys for 2026', () => {
    expect(generateAccessKey(2026, [])).toBe('2026001');
  });
  it('increments highest existing 2026 key', () => {
    expect(generateAccessKey(2026, ['2026001', '2026002', '2026005'])).toBe('2026006');
  });
  it('ignores keys from other years', () => {
    expect(generateAccessKey(2026, ['2025099', '2024500'])).toBe('2026001');
  });
  it('pads to 3 digits', () => {
    expect(generateAccessKey(2026, ['2026008'])).toBe('2026009');
  });
});

describe('generateBatchAccessKeys', () => {
  it('returns N unique sequential keys', () => {
    expect(generateBatchAccessKeys(2026, ['2026005'], 3)).toEqual(['2026006', '2026007', '2026008']);
  });
});
