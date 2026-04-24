# Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin-only Excel import page that syncs yearly Kingdom Kids attendance/points from `.xlsx` into Supabase, with interactive name matching and auto-generated accessKeys for new students.

**Architecture:** Browser-side Excel parsing (SheetJS) → fetch existing students → interactive name matching (exact → fuzzy → user choice) → diff preview → batched upsert. New students get `YYYY###` accessKey so they become QR-scannable immediately.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (existing), `xlsx` (SheetJS), Vitest, existing React Router v6 + role-gated auth.

**Spec:** `docs/superpowers/specs/2026-04-24-excel-import-design.md`

---

## File Structure

```
kingdom-kids/
├── package.json                              (modify — add xlsx)
├── utils/
│   ├── excelParser.ts                        (create — parse both sheets → normalized)
│   ├── nameMatcher.ts                        (create — Levenshtein + exact match)
│   ├── accessKeyGenerator.ts                 (create — YYYY### generation)
│   └── importBatcher.ts                      (create — chunked upsert, resume)
├── services/
│   └── db.service.ts                         (modify — add import CRUD fns)
├── pages/
│   └── ExcelImportPage.tsx                   (create — main page, state machine)
├── components/excel-import/
│   ├── FileUpload.tsx                        (create)
│   ├── NameMatcher.tsx                       (create)
│   ├── DiffPreview.tsx                       (create)
│   └── ImportProgress.tsx                    (create)
├── App.tsx                                    (modify — add route)
└── __tests__/
    ├── excelParser.test.ts                   (create)
    ├── nameMatcher.test.ts                   (create)
    └── accessKeyGenerator.test.ts            (create)
```

---

## Task 1: Install xlsx dependency

**Files:**
- Modify: `kingdom-kids/package.json`

- [ ] **Step 1: Add xlsx dependency**

Run:
```bash
cd kingdom-kids && npm install xlsx@0.18.5 --save
```

Expected output: `added 1 package`

- [ ] **Step 2: Verify installed**

Run:
```bash
grep '"xlsx"' kingdom-kids/package.json
```

Expected: `"xlsx": "^0.18.5",`

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/package.json kingdom-kids/package-lock.json
git commit -m "chore: add xlsx dependency for Excel import"
```

---

## Task 2: Excel Parser — Failing Tests

**Files:**
- Create: `kingdom-kids/__tests__/excelParser.test.ts`
- Create: `kingdom-kids/utils/excelParser.ts` (empty stub for import)

- [ ] **Step 1: Create empty parser module**

Create `kingdom-kids/utils/excelParser.ts`:
```typescript
export interface ParsedStudent {
  name: string;
  ageGroup: string;
  dates: Record<string, { attended: boolean; points: number }>;
  totalAttendance: number;
  isGraduate: boolean;
}

export function parseWorkbook(buffer: ArrayBuffer): ParsedStudent[] {
  throw new Error('not implemented');
}

export function mapAgeGroup(header: string): string {
  throw new Error('not implemented');
}

export function normalizeDate(excelDate: string, year: number): string {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Write failing tests**

Create `kingdom-kids/__tests__/excelParser.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run tests — expect failure**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/excelParser.test.ts
```

Expected: FAIL with "not implemented" errors on all tests.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/utils/excelParser.ts kingdom-kids/__tests__/excelParser.test.ts
git commit -m "test: excelParser failing tests"
```

---

## Task 3: Implement mapAgeGroup + normalizeDate

**Files:**
- Modify: `kingdom-kids/utils/excelParser.ts`

- [ ] **Step 1: Implement mapAgeGroup**

Replace `mapAgeGroup` in `kingdom-kids/utils/excelParser.ts`:
```typescript
export function mapAgeGroup(header: string): string {
  const h = header.trim().toUpperCase();
  if (h.includes('4-6') || h.includes('4 - 6')) return '3-6';
  if (h.includes('7-9') || h.includes('7 - 9')) return '7-9';
  if (h.includes('10-12') || h.includes('10 - 12')) return '10-12';
  return 'General';
}
```

- [ ] **Step 2: Implement normalizeDate**

Replace `normalizeDate` in same file:
```typescript
export function normalizeDate(excelDate: string, year: number): string {
  const [m, d] = excelDate.split('/').map(n => parseInt(n, 10));
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
```

- [ ] **Step 3: Run tests — expect pass**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/excelParser.test.ts -t "mapAgeGroup|normalizeDate"
```

Expected: 7 passing tests.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/utils/excelParser.ts
git commit -m "feat: implement mapAgeGroup and normalizeDate"
```

---

## Task 4: Parse Workbook — Failing Test

**Files:**
- Modify: `kingdom-kids/__tests__/excelParser.test.ts`

- [ ] **Step 1: Add workbook test using fixture buffer**

Append to `kingdom-kids/__tests__/excelParser.test.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import { parseWorkbook } from '../utils/excelParser';

describe('parseWorkbook', () => {
  const fixturePath = path.resolve(__dirname, '../yearly kingdom kids 2026.xlsx');
  const buffer = fs.readFileSync(fixturePath).buffer as ArrayBuffer;

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
```

- [ ] **Step 2: Run test — expect failure**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/excelParser.test.ts -t "parseWorkbook"
```

Expected: FAIL with "not implemented".

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/__tests__/excelParser.test.ts
git commit -m "test: parseWorkbook failing tests"
```

---

## Task 5: Implement parseWorkbook

**Files:**
- Modify: `kingdom-kids/utils/excelParser.ts`

- [ ] **Step 1: Implement parseWorkbook**

Replace `parseWorkbook` stub in `kingdom-kids/utils/excelParser.ts`:
```typescript
import * as XLSX from 'xlsx';

function parseSheet(ws: XLSX.WorkSheet): Array<{ name: string; ageGroup: string; rowData: Record<string, any> }> {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerRow = rows[0] || [];
  const dateHeaders: { col: number; date: string }[] = [];

  for (let c = 0; c < headerRow.length; c++) {
    const cell = headerRow[c];
    if (typeof cell === 'string' && /^\d{1,2}\/\d{1,2}$/.test(cell.trim())) {
      dateHeaders.push({ col: c, date: cell.trim() });
    }
  }

  const out: Array<{ name: string; ageGroup: string; rowData: Record<string, any> }> = [];
  let currentAgeGroup = 'General';

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const col0 = typeof row[0] === 'string' ? row[0].trim() : '';
    const col2 = typeof row[2] === 'string' ? row[2].trim() : '';

    if (col0 && col0.toUpperCase().includes('YRS OLD')) {
      currentAgeGroup = mapAgeGroup(col0);
      continue;
    }

    if (!col2 || !col2.includes(',')) continue;

    const rowData: Record<string, any> = {};
    for (const dh of dateHeaders) rowData[dh.date] = row[dh.col];
    out.push({ name: col2, ageGroup: currentAgeGroup, rowData });
  }
  return out;
}

export function parseWorkbook(buffer: ArrayBuffer): ParsedStudent[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const year = 2026;

  const attSheet = wb.Sheets['2026'];
  const pointsSheet = wb.Sheets['2026 points'];
  if (!attSheet) throw new Error('Sheet "2026" not found');

  const attRows = parseSheet(attSheet);
  const pointsRows = pointsSheet ? parseSheet(pointsSheet) : [];
  const pointsByName = new Map(pointsRows.map(r => [r.name, r.rowData]));

  const result: ParsedStudent[] = [];
  for (const rec of attRows) {
    const dates: ParsedStudent['dates'] = {};
    const pointsRow = pointsByName.get(rec.name) || {};

    for (const [excelDate, val] of Object.entries(rec.rowData)) {
      const iso = normalizeDate(excelDate, year);
      const attended = val === 1 || val === '1';
      const pts = Number(pointsRow[excelDate]) || 0;
      if (attended || pts > 0) dates[iso] = { attended, points: pts };
    }

    const totalAttendance = Object.values(dates).filter(d => d.attended).length;
    result.push({
      name: rec.name,
      ageGroup: rec.ageGroup,
      dates,
      totalAttendance,
      isGraduate: false,
    });
  }
  return result;
}
```

- [ ] **Step 2: Run tests — expect pass**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/excelParser.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/utils/excelParser.ts
git commit -m "feat: implement parseWorkbook with both sheets merged"
```

---

## Task 6: Name Matcher — Failing Tests

**Files:**
- Create: `kingdom-kids/utils/nameMatcher.ts`
- Create: `kingdom-kids/__tests__/nameMatcher.test.ts`

- [ ] **Step 1: Create stub**

Create `kingdom-kids/utils/nameMatcher.ts`:
```typescript
export interface MatchResult {
  excelName: string;
  status: 'exact' | 'fuzzy' | 'unmatched';
  studentId?: string;
  suggestedName?: string;
  distance?: number;
}

export function levenshtein(a: string, b: string): number {
  throw new Error('not implemented');
}

export function normalizeName(s: string): string {
  throw new Error('not implemented');
}

export function matchNames(
  excelNames: string[],
  students: Array<{ id: string; fullName: string }>
): MatchResult[] {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Write tests**

Create `kingdom-kids/__tests__/nameMatcher.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run — expect failures**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/nameMatcher.test.ts
```

Expected: FAIL all.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/utils/nameMatcher.ts kingdom-kids/__tests__/nameMatcher.test.ts
git commit -m "test: nameMatcher failing tests"
```

---

## Task 7: Implement Name Matcher

**Files:**
- Modify: `kingdom-kids/utils/nameMatcher.ts`

- [ ] **Step 1: Implement all functions**

Replace entire `kingdom-kids/utils/nameMatcher.ts`:
```typescript
export interface MatchResult {
  excelName: string;
  status: 'exact' | 'fuzzy' | 'unmatched';
  studentId?: string;
  suggestedName?: string;
  distance?: number;
}

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function matchNames(
  excelNames: string[],
  students: Array<{ id: string; fullName: string }>
): MatchResult[] {
  const norm = students.map(s => ({ id: s.id, full: s.fullName, n: normalizeName(s.fullName) }));
  return excelNames.map(name => {
    const nn = normalizeName(name);
    const exact = norm.find(s => s.n === nn);
    if (exact) return { excelName: name, status: 'exact', studentId: exact.id };

    let best: { id: string; full: string; d: number } | null = null;
    for (const s of norm) {
      const d = levenshtein(nn, s.n);
      if (d < 3 && (!best || d < best.d)) best = { id: s.id, full: s.full, d };
    }
    if (best) {
      return { excelName: name, status: 'fuzzy', studentId: best.id, suggestedName: best.full, distance: best.d };
    }
    return { excelName: name, status: 'unmatched' };
  });
}
```

- [ ] **Step 2: Run tests — expect pass**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/nameMatcher.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/utils/nameMatcher.ts
git commit -m "feat: implement nameMatcher with Levenshtein fuzzy"
```

---

## Task 8: AccessKey Generator — Failing Tests

**Files:**
- Create: `kingdom-kids/utils/accessKeyGenerator.ts`
- Create: `kingdom-kids/__tests__/accessKeyGenerator.test.ts`

- [ ] **Step 1: Create stub**

Create `kingdom-kids/utils/accessKeyGenerator.ts`:
```typescript
export function generateAccessKey(year: number, existingKeys: string[]): string {
  throw new Error('not implemented');
}

export function generateBatchAccessKeys(year: number, existingKeys: string[], count: number): string[] {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Write tests**

Create `kingdom-kids/__tests__/accessKeyGenerator.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run — expect failures**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/accessKeyGenerator.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/utils/accessKeyGenerator.ts kingdom-kids/__tests__/accessKeyGenerator.test.ts
git commit -m "test: accessKeyGenerator failing tests"
```

---

## Task 9: Implement AccessKey Generator

**Files:**
- Modify: `kingdom-kids/utils/accessKeyGenerator.ts`

- [ ] **Step 1: Implement**

Replace file:
```typescript
export function generateAccessKey(year: number, existingKeys: string[]): string {
  const prefix = String(year);
  const suffixes = existingKeys
    .filter(k => k.startsWith(prefix) && k.length === 7)
    .map(k => parseInt(k.slice(4), 10))
    .filter(n => !isNaN(n));
  const next = (suffixes.length > 0 ? Math.max(...suffixes) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export function generateBatchAccessKeys(year: number, existingKeys: string[], count: number): string[] {
  const keys: string[] = [];
  const running = [...existingKeys];
  for (let i = 0; i < count; i++) {
    const k = generateAccessKey(year, running);
    keys.push(k);
    running.push(k);
  }
  return keys;
}
```

- [ ] **Step 2: Run — expect pass**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/accessKeyGenerator.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/utils/accessKeyGenerator.ts
git commit -m "feat: implement accessKey generator"
```

---

## Task 10: db.service.ts — Import Functions

**Files:**
- Modify: `kingdom-kids/services/db.service.ts`

- [ ] **Step 1: Read existing file to find insertion point**

Run:
```bash
grep -n "^export" kingdom-kids/services/db.service.ts | head -20
```

Note the file's export pattern to follow it.

- [ ] **Step 2: Append import functions**

Append to `kingdom-kids/services/db.service.ts`:
```typescript
// ============================================================
// Excel Import functions
// ============================================================
import { supabase } from './supabase';

export async function listAllAccessKeys(): Promise<string[]> {
  const { data, error } = await supabase
    .from('students')
    .select('accessKey');
  if (error) throw error;
  return (data || []).map((r: any) => r.accessKey).filter(Boolean);
}

export async function createStudentForImport(payload: {
  accessKey: string;
  fullName: string;
  ageGroup: string;
  isGraduate: boolean;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('students')
    .insert({
      accessKey: payload.accessKey,
      fullName: payload.fullName,
      ageGroup: payload.ageGroup,
      isEnrolled: true,
      studentStatus: payload.isGraduate ? 'alumni' : 'active',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function upsertAttendanceForImport(rows: Array<{
  studentId: string;
  sessionDate: string;
}>): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map(r => ({
    studentId: r.studentId,
    sessionDate: r.sessionDate,
    checkInTime: '09:00',
    checkoutMode: 'MANUAL',
    checkedInBy: 'EXCEL_IMPORT',
    status: 'CLOSED',
  }));
  const { error } = await supabase
    .from('attendance_sessions')
    .upsert(payload, { onConflict: 'studentId,sessionDate' });
  if (error) throw error;
}

export async function upsertPointsForImport(rows: Array<{
  studentId: string;
  entryDate: string;
  points: number;
}>): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map(r => ({
    studentId: r.studentId,
    entryDate: r.entryDate,
    category: 'EXCEL_IMPORT',
    points: r.points,
    recordedBy: 'EXCEL_IMPORT',
    voided: false,
  }));
  const { error } = await supabase
    .from('point_ledger')
    .upsert(payload, { onConflict: 'studentId,entryDate,category' });
  if (error) throw error;
}

export async function updateGraduateStatus(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ studentStatus: 'alumni' })
    .eq('id', studentId);
  if (error) throw error;
}
```

- [ ] **Step 3: Verify Supabase unique constraints exist**

Run (via Supabase SQL editor, document for user):
```sql
-- Required for upsert onConflict:
ALTER TABLE attendance_sessions
  ADD CONSTRAINT uq_attendance_student_date UNIQUE ("studentId", "sessionDate");

ALTER TABLE point_ledger
  ADD CONSTRAINT uq_point_student_date_cat UNIQUE ("studentId", "entryDate", category);
```

Include a note: user must run above in Supabase SQL Editor before import works.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/services/db.service.ts
git commit -m "feat: add Excel import DB functions"
```

---

## Task 11: Import Batcher

**Files:**
- Create: `kingdom-kids/utils/importBatcher.ts`

- [ ] **Step 1: Create batcher**

Create `kingdom-kids/utils/importBatcher.ts`:
```typescript
export async function processBatched<T>(
  items: T[],
  batchSize: number,
  handler: (batch: T[]) => Promise<void>,
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: number; errors: Array<{ batchIndex: number; error: string }> }> {
  const errors: Array<{ batchIndex: number; error: string }> = [];
  let succeeded = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      await handler(batch);
      succeeded += batch.length;
    } catch (e: any) {
      errors.push({ batchIndex: Math.floor(i / batchSize), error: e?.message || String(e) });
    }
    onProgress?.(Math.min(i + batchSize, items.length), items.length);
  }
  return { succeeded, errors };
}
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/utils/importBatcher.ts
git commit -m "feat: add import batcher utility"
```

---

## Task 12: FileUpload Component

**Files:**
- Create: `kingdom-kids/components/excel-import/FileUpload.tsx`

- [ ] **Step 1: Create component**

Create `kingdom-kids/components/excel-import/FileUpload.tsx`:
```typescript
import React, { useRef, useState } from 'react';

interface Props {
  onFileRead: (buffer: ArrayBuffer, fileName: string) => void;
}

const FileUpload: React.FC<Props> = ({ onFileRead }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Only .xlsx files accepted');
      return;
    }
    const buf = await file.arrayBuffer();
    onFileRead(buf, file.name);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
    >
      <p className="text-lg font-semibold">Drop .xlsx file here or click to browse</p>
      {error && <p className="text-red-500 mt-3 text-sm">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
};

export default FileUpload;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/excel-import/FileUpload.tsx
git commit -m "feat: FileUpload component"
```

---

## Task 13: NameMatcher Component

**Files:**
- Create: `kingdom-kids/components/excel-import/NameMatcher.tsx`

- [ ] **Step 1: Create component**

Create `kingdom-kids/components/excel-import/NameMatcher.tsx`:
```typescript
import React from 'react';
import type { MatchResult } from '../../utils/nameMatcher';

export type Resolution =
  | { type: 'use-existing'; studentId: string }
  | { type: 'create-new' }
  | { type: 'skip' };

interface Props {
  matches: MatchResult[];
  students: Array<{ id: string; fullName: string }>;
  resolutions: Record<string, Resolution>;
  onResolve: (excelName: string, res: Resolution) => void;
  onDone: () => void;
}

const NameMatcher: React.FC<Props> = ({ matches, students, resolutions, onResolve, onDone }) => {
  const needsReview = matches.filter(m => m.status !== 'exact');
  const unresolvedCount = needsReview.filter(m => !resolutions[m.excelName]).length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Resolve {needsReview.length} unmatched names</h2>
      <p className="text-sm text-slate-600 mb-4">Exact matches auto-resolved. Review fuzzy/unmatched below.</p>

      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Excel Name</th>
            <th className="p-2 text-left">Suggestion</th>
            <th className="p-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {needsReview.map(m => {
            const res = resolutions[m.excelName];
            return (
              <tr key={m.excelName} className="border-t">
                <td className="p-2 font-mono">{m.excelName}</td>
                <td className="p-2 text-slate-500">
                  {m.suggestedName ? `${m.suggestedName} (${m.distance} edits)` : 'No match'}
                </td>
                <td className="p-2">
                  <select
                    value={res ? JSON.stringify(res) : ''}
                    onChange={e => {
                      const v = e.target.value;
                      if (v) onResolve(m.excelName, JSON.parse(v));
                    }}
                    className="border rounded p-1 text-xs w-full"
                  >
                    <option value="">-- Select --</option>
                    {m.suggestedName && m.studentId && (
                      <option value={JSON.stringify({ type: 'use-existing', studentId: m.studentId })}>
                        Use suggested: {m.suggestedName}
                      </option>
                    )}
                    <option value={JSON.stringify({ type: 'create-new' })}>Create new student</option>
                    <option value={JSON.stringify({ type: 'skip' })}>Skip</option>
                    <optgroup label="Pick existing">
                      {students.map(s => (
                        <option key={s.id} value={JSON.stringify({ type: 'use-existing', studentId: s.id })}>
                          {s.fullName}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        disabled={unresolvedCount > 0}
        onClick={onDone}
        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-40"
      >
        Continue ({unresolvedCount} pending)
      </button>
    </div>
  );
};

export default NameMatcher;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/excel-import/NameMatcher.tsx
git commit -m "feat: NameMatcher component"
```

---

## Task 14: DiffPreview Component

**Files:**
- Create: `kingdom-kids/components/excel-import/DiffPreview.tsx`

- [ ] **Step 1: Create**

Create `kingdom-kids/components/excel-import/DiffPreview.tsx`:
```typescript
import React from 'react';
import type { ParsedStudent } from '../../utils/excelParser';

export interface PreviewRow {
  excelName: string;
  action: 'create' | 'update' | 'skip';
  resolvedStudentId?: string;
  newAccessKey?: string;
  attendanceDates: string[];
  pointDates: string[];
  totalPoints: number;
}

interface Props {
  rows: PreviewRow[];
  onConfirm: () => void;
  onBack: () => void;
}

const DiffPreview: React.FC<Props> = ({ rows, onConfirm, onBack }) => {
  const creates = rows.filter(r => r.action === 'create').length;
  const updates = rows.filter(r => r.action === 'update').length;
  const skips = rows.filter(r => r.action === 'skip').length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Import Preview</h2>
      <div className="flex gap-4 mb-4 text-sm">
        <span className="bg-green-100 px-3 py-1 rounded">New: {creates}</span>
        <span className="bg-blue-100 px-3 py-1 rounded">Update: {updates}</span>
        <span className="bg-slate-100 px-3 py-1 rounded">Skip: {skips}</span>
      </div>

      <div className="max-h-96 overflow-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">New Key</th>
              <th className="p-2 text-right">Attendance</th>
              <th className="p-2 text-right">Points Entries</th>
              <th className="p-2 text-right">Total Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.excelName} className="border-t">
                <td className="p-2 font-mono">{r.excelName}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2 font-mono">{r.newAccessKey || '-'}</td>
                <td className="p-2 text-right">{r.attendanceDates.length}</td>
                <td className="p-2 text-right">{r.pointDates.length}</td>
                <td className="p-2 text-right">{r.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="px-4 py-2 border rounded">Back</button>
        <button onClick={onConfirm} className="bg-green-600 text-white px-6 py-2 rounded">
          Confirm Import
        </button>
      </div>
    </div>
  );
};

export default DiffPreview;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/excel-import/DiffPreview.tsx
git commit -m "feat: DiffPreview component"
```

---

## Task 15: ImportProgress Component

**Files:**
- Create: `kingdom-kids/components/excel-import/ImportProgress.tsx`

- [ ] **Step 1: Create**

Create `kingdom-kids/components/excel-import/ImportProgress.tsx`:
```typescript
import React from 'react';

interface Props {
  totalItems: number;
  processedItems: number;
  errors: Array<{ name: string; error: string }>;
  done: boolean;
  onFinish: () => void;
}

const ImportProgress: React.FC<Props> = ({ totalItems, processedItems, errors, done, onFinish }) => {
  const pct = totalItems === 0 ? 100 : Math.round((processedItems / totalItems) * 100);
  return (
    <div>
      <h2 className="text-xl font-bold mb-3">{done ? 'Import Complete' : 'Importing...'}</h2>
      <div className="w-full bg-slate-200 rounded-full h-4 mb-2">
        <div className="bg-blue-600 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-slate-600 mb-4">
        {processedItems} / {totalItems} ({pct}%)
      </p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <h3 className="font-bold text-red-700 mb-2">{errors.length} errors</h3>
          <ul className="text-xs text-red-600 max-h-40 overflow-auto">
            {errors.map((e, i) => (
              <li key={i}>{e.name}: {e.error}</li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <button onClick={onFinish} className="bg-blue-600 text-white px-6 py-2 rounded">
          Done
        </button>
      )}
    </div>
  );
};

export default ImportProgress;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/excel-import/ImportProgress.tsx
git commit -m "feat: ImportProgress component"
```

---

## Task 16: ExcelImportPage — State Machine + Integration

**Files:**
- Create: `kingdom-kids/pages/ExcelImportPage.tsx`

- [ ] **Step 1: Create page**

Create `kingdom-kids/pages/ExcelImportPage.tsx`:
```typescript
import React, { useState } from 'react';
import FileUpload from '../components/excel-import/FileUpload';
import NameMatcher, { Resolution } from '../components/excel-import/NameMatcher';
import DiffPreview, { PreviewRow } from '../components/excel-import/DiffPreview';
import ImportProgress from '../components/excel-import/ImportProgress';
import { parseWorkbook, ParsedStudent } from '../utils/excelParser';
import { matchNames, MatchResult } from '../utils/nameMatcher';
import { generateBatchAccessKeys } from '../utils/accessKeyGenerator';
import { processBatched } from '../utils/importBatcher';
import {
  listAllAccessKeys,
  createStudentForImport,
  upsertAttendanceForImport,
  upsertPointsForImport,
  updateGraduateStatus,
} from '../services/db.service';
import { supabase } from '../services/supabase';

type Step = 'UPLOAD' | 'MATCHING' | 'PREVIEW' | 'IMPORTING' | 'DONE';

const ExcelImportPage: React.FC = () => {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; fullName: string }>>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<Array<{ name: string; error: string }>>([]);

  const handleFile = async (buffer: ArrayBuffer) => {
    const rows = parseWorkbook(buffer);
    setParsed(rows);
    const { data } = await supabase.from('students').select('id, fullName');
    const studs = (data || []) as Array<{ id: string; fullName: string }>;
    setStudents(studs);
    const ms = matchNames(rows.map(r => r.name), studs);
    setMatches(ms);

    // auto-resolve exact matches
    const auto: Record<string, Resolution> = {};
    for (const m of ms) {
      if (m.status === 'exact' && m.studentId) {
        auto[m.excelName] = { type: 'use-existing', studentId: m.studentId };
      }
    }
    setResolutions(auto);
    setStep('MATCHING');
  };

  const handleResolve = (excelName: string, res: Resolution) => {
    setResolutions(prev => ({ ...prev, [excelName]: res }));
  };

  const buildPreview = async () => {
    const existingKeys = await listAllAccessKeys();
    const newCount = Object.values(resolutions).filter(r => r.type === 'create-new').length;
    const newKeys = generateBatchAccessKeys(2026, existingKeys, newCount);
    let keyIdx = 0;

    const rows: PreviewRow[] = parsed.map(p => {
      const res = resolutions[p.name];
      if (!res || res.type === 'skip') {
        return { excelName: p.name, action: 'skip', attendanceDates: [], pointDates: [], totalPoints: 0 };
      }
      const attendanceDates = Object.keys(p.dates).filter(d => p.dates[d].attended);
      const pointDates = Object.keys(p.dates).filter(d => p.dates[d].points > 0);
      const totalPoints = Object.values(p.dates).reduce((s, d) => s + d.points, 0);

      if (res.type === 'create-new') {
        return {
          excelName: p.name,
          action: 'create',
          newAccessKey: newKeys[keyIdx++],
          attendanceDates,
          pointDates,
          totalPoints,
        };
      }
      return {
        excelName: p.name,
        action: 'update',
        resolvedStudentId: res.studentId,
        attendanceDates,
        pointDates,
        totalPoints,
      };
    });

    setPreview(rows);
    setStep('PREVIEW');
  };

  const runImport = async () => {
    setStep('IMPORTING');
    const total = preview.filter(r => r.action !== 'skip').length;
    setProgress({ done: 0, total });
    const errs: Array<{ name: string; error: string }> = [];
    let done = 0;

    // map excelName → studentId (fill in after creates)
    const studentIdByName: Record<string, string> = {};

    for (const row of preview) {
      if (row.action === 'skip') continue;
      try {
        if (row.action === 'create') {
          const parsedRec = parsed.find(p => p.name === row.excelName)!;
          const created = await createStudentForImport({
            accessKey: row.newAccessKey!,
            fullName: row.excelName,
            ageGroup: parsedRec.ageGroup,
            isGraduate: parsedRec.isGraduate,
          });
          studentIdByName[row.excelName] = created.id;
        } else {
          studentIdByName[row.excelName] = row.resolvedStudentId!;
        }
      } catch (e: any) {
        errs.push({ name: row.excelName, error: e?.message || String(e) });
        done++;
        setProgress({ done, total });
        continue;
      }
      done++;
      setProgress({ done, total });
    }

    // Batch attendance
    const attendanceRows = preview.flatMap(r =>
      r.action === 'skip' ? [] : r.attendanceDates.map(d => ({
        studentId: studentIdByName[r.excelName],
        sessionDate: d,
      })).filter(x => x.studentId)
    );
    const attResult = await processBatched(attendanceRows, 50, upsertAttendanceForImport);
    attResult.errors.forEach(e => errs.push({ name: `attendance batch ${e.batchIndex}`, error: e.error }));

    // Batch points
    const pointRows = preview.flatMap(r =>
      r.action === 'skip' ? [] : r.pointDates.map(d => {
        const parsedRec = parsed.find(p => p.name === r.excelName)!;
        return {
          studentId: studentIdByName[r.excelName],
          entryDate: d,
          points: parsedRec.dates[d].points,
        };
      }).filter(x => x.studentId)
    );
    const ptResult = await processBatched(pointRows, 50, upsertPointsForImport);
    ptResult.errors.forEach(e => errs.push({ name: `points batch ${e.batchIndex}`, error: e.error }));

    // Graduate flags
    for (const r of preview) {
      if (r.action === 'skip') continue;
      const parsedRec = parsed.find(p => p.name === r.excelName);
      if (parsedRec?.isGraduate && studentIdByName[r.excelName]) {
        try { await updateGraduateStatus(studentIdByName[r.excelName]); } catch {}
      }
    }

    setErrors(errs);
    setStep('DONE');
    localStorage.setItem('kk_last_import', JSON.stringify({
      ts: Date.now(),
      counts: { total, errors: errs.length },
    }));
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Excel Import — Yearly Attendance</h1>
      {step === 'UPLOAD' && <FileUpload onFileRead={handleFile} />}
      {step === 'MATCHING' && (
        <NameMatcher
          matches={matches}
          students={students}
          resolutions={resolutions}
          onResolve={handleResolve}
          onDone={buildPreview}
        />
      )}
      {step === 'PREVIEW' && (
        <DiffPreview rows={preview} onBack={() => setStep('MATCHING')} onConfirm={runImport} />
      )}
      {(step === 'IMPORTING' || step === 'DONE') && (
        <ImportProgress
          totalItems={progress.total}
          processedItems={progress.done}
          errors={errors}
          done={step === 'DONE'}
          onFinish={() => setStep('UPLOAD')}
        />
      )}
    </div>
  );
};

export default ExcelImportPage;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/pages/ExcelImportPage.tsx
git commit -m "feat: ExcelImportPage orchestrator"
```

---

## Task 17: Add Route + Admin Navigation

**Files:**
- Modify: `kingdom-kids/App.tsx`

- [ ] **Step 1: Find existing admin route pattern**

Run:
```bash
grep -n "Route" kingdom-kids/App.tsx | head -20
```

Note existing route syntax.

- [ ] **Step 2: Add route gated to ADMIN**

In `kingdom-kids/App.tsx`, add import at top:
```typescript
import ExcelImportPage from './pages/ExcelImportPage';
```

Add route inside the Routes block (after existing admin route):
```tsx
<Route
  path="/admin/import"
  element={session?.role === 'ADMIN' ? <ExcelImportPage /> : <Navigate to="/" />}
/>
```

(Match the exact pattern used by other admin routes in the file — if they use a wrapper component, use the same.)

- [ ] **Step 3: Add nav link in admin dashboard**

Find `kingdom-kids/pages/AdminDashboard.tsx` or main admin nav. Add link:
```tsx
<Link to="/admin/import" className="px-4 py-2 bg-blue-600 text-white rounded">
  Excel Import
</Link>
```

- [ ] **Step 4: Build check**

Run:
```bash
cd kingdom-kids && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add kingdom-kids/App.tsx kingdom-kids/pages/AdminDashboard.tsx
git commit -m "feat: wire /admin/import route and nav link"
```

---

## Task 18: Add DB Constraints (Supabase-side)

**Files:**
- Create: `kingdom-kids/supabase-migrations/2026-04-24-excel-import-constraints.sql`

- [ ] **Step 1: Create migration SQL**

Create `kingdom-kids/supabase-migrations/2026-04-24-excel-import-constraints.sql`:
```sql
ALTER TABLE attendance_sessions
  ADD CONSTRAINT IF NOT EXISTS uq_attendance_student_date
  UNIQUE ("studentId", "sessionDate");

ALTER TABLE point_ledger
  ADD CONSTRAINT IF NOT EXISTS uq_point_student_date_cat
  UNIQUE ("studentId", "entryDate", category);
```

- [ ] **Step 2: Document in README**

Append to `kingdom-kids/README.md` (or create section):
```markdown
## Excel Import Setup

Before using `/admin/import`, run the migration SQL in Supabase SQL Editor:
`supabase-migrations/2026-04-24-excel-import-constraints.sql`
```

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/supabase-migrations/ kingdom-kids/README.md
git commit -m "docs: Excel import Supabase constraints migration"
```

---

## Task 19: Manual E2E Smoke Test

**Files:** none

- [ ] **Step 1: Run migration SQL**

In Supabase SQL Editor, paste and run content of `supabase-migrations/2026-04-24-excel-import-constraints.sql`.

- [ ] **Step 2: Start dev server**

Run:
```bash
cd kingdom-kids && npm run dev
```

- [ ] **Step 3: Login as ADMIN, navigate to /admin/import**

- [ ] **Step 4: Upload `yearly kingdom kids 2026.xlsx`**

Verify: upload parses, shows matching screen.

- [ ] **Step 5: Resolve unmatched names**

Pick "Create new" for unknown students, "Use existing" for fuzzy suggestions.

- [ ] **Step 6: Confirm preview shows correct counts**

Verify: creates, updates, skips accurate.

- [ ] **Step 7: Confirm import**

Verify: progress bar completes, errors empty or minimal.

- [ ] **Step 8: Verify in Supabase Table Editor**

Query:
```sql
SELECT COUNT(*) FROM students WHERE "accessKey" LIKE '2026%';
SELECT COUNT(*) FROM attendance_sessions WHERE "checkedInBy" = 'EXCEL_IMPORT';
SELECT COUNT(*) FROM point_ledger WHERE category = 'EXCEL_IMPORT';
```

Expected: non-zero counts matching Excel.

- [ ] **Step 9: Verify QR scanning works for new student**

Take an auto-generated `2026###` accessKey, print QR, test on `/qr-scan` page — should check in successfully.

- [ ] **Step 10: Commit E2E notes**

```bash
git commit --allow-empty -m "test: manual E2E smoke pass for Excel import"
```

---

## Self-Review Results

- [x] **Spec coverage:** All sections covered — architecture (Task 16), components (Tasks 12-15), data mapping (Tasks 5, 10), accessKey generation (Task 9), batching (Task 11), testing (Tasks 2-9, 19)
- [x] **Placeholder scan:** No TBDs, all code blocks complete
- [x] **Type consistency:** `MatchResult`, `Resolution`, `PreviewRow`, `ParsedStudent` used consistently across tasks

---

## Execution Handoff

Plan complete. After running, proceed to Plan B (ID Issuance Monitoring).
