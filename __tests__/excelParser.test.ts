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

import fs from 'fs';
import path from 'path';
import { parseWorkbook } from '../utils/excelParser';

describe('parseWorkbook', () => {
  const fixturePath = path.resolve(__dirname, '../yearly kingdom kids 2026.xlsx');
  const nodeBuf = fs.readFileSync(fixturePath);
  const buffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer;

  it('returns array of parsed students', () => {
    const result = parseWorkbook(buffer);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('extracts student name in "LastName, FirstName" format', () => {
    const result = parseWorkbook(buffer);
    const student = result.find(s => s.name.includes('Abunio'));
    expect(student).toBeDefined();
    expect(student?.name).toBe('Abunio, Hailey');
  });

  it('skips section header rows (no comma in name)', () => {
    const result = parseWorkbook(buffer);
    const headerRow = result.find(s => s.name === '4-6 YRS OLD AND BELOW');
    expect(headerRow).toBeUndefined();
  });

  it('attaches ageGroup from preceding header', () => {
    const result = parseWorkbook(buffer);
    const student = result.find(s => s.name === 'Abunio, Hailey');
    expect(student?.ageGroup).toBe('3-6');
  });

  it('merges attendance and points from both sheets', () => {
    const result = parseWorkbook(buffer);
    const student = result.find(s => s.name === 'Agustin, Nasya Zoey S.');
    const date = Object.keys(student!.dates).find(d => student!.dates[d].points === 10);
    expect(date).toBeDefined();
  });
});
