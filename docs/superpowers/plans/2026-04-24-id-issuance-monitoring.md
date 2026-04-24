# ID Issuance Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-only page to monitor ID card issuance status (Has ID, Needs Reprint, Qualified, Not Yet), with embedded QR scanner for scan-to-tag workflow and lost-ID lifecycle.

**Architecture:** New `/admin/id-issuance` page. Fetches students + attendance, computes 4-consecutive-Sunday streak, groups into 4 buckets. Embedded QR scanner tags student on scan; branching toast based on bucket.

**Tech Stack:** React 18 + TypeScript, Supabase (existing), existing QR scanner component, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-24-id-issuance-monitoring-design.md`

---

## File Structure

```
kingdom-kids/
├── supabase-migrations/
│   └── 2026-04-24-id-issuance-columns.sql    (create)
├── types.ts                                    (modify — add ID fields to Student)
├── utils/
│   └── sundayStreak.ts                         (create — consecutive Sunday logic)
├── services/
│   └── db.service.ts                           (modify — add ID issuance fns)
├── pages/
│   └── IdIssuancePage.tsx                      (create — main page)
├── components/id-issuance/
│   ├── SummaryBar.tsx                          (create)
│   ├── StudentCard.tsx                         (create)
│   ├── ScanResultToast.tsx                     (create)
│   └── ConfirmDialog.tsx                       (create)
├── App.tsx                                     (modify — add route)
└── __tests__/
    ├── sundayStreak.test.ts                    (create)
    └── bucketCategorization.test.ts            (create)
```

---

## Task 1: DB Migration

**Files:**
- Create: `kingdom-kids/supabase-migrations/2026-04-24-id-issuance-columns.sql`

- [ ] **Step 1: Create migration SQL**

Create `kingdom-kids/supabase-migrations/2026-04-24-id-issuance-columns.sql`:
```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS id_issued_at      TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS id_needs_reprint  BOOLEAN     DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS id_reprint_count  INT         DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS id_last_lost_at   TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_students_id_issued_at ON students(id_issued_at);
CREATE INDEX IF NOT EXISTS idx_students_id_needs_reprint ON students(id_needs_reprint) WHERE id_needs_reprint = TRUE;
```

- [ ] **Step 2: Document in README**

Append to `kingdom-kids/README.md`:
```markdown
## ID Issuance Setup
Run `supabase-migrations/2026-04-24-id-issuance-columns.sql` in Supabase SQL Editor before deploying.
```

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/supabase-migrations/ kingdom-kids/README.md
git commit -m "feat: id-issuance DB migration (4 columns + indexes)"
```

---

## Task 2: Extend Student Type

**Files:**
- Modify: `kingdom-kids/types.ts`

- [ ] **Step 1: Add fields to Student interface**

Find `Student` interface in `kingdom-kids/types.ts`. Add these fields:
```typescript
  idIssuedAt?: string | null;      // ISO timestamp — when current card issued
  idNeedsReprint?: boolean;        // true if lost, awaiting new card
  idReprintCount?: number;         // lifetime reprint count
  idLastLostAt?: string | null;    // ISO timestamp of last loss report
```

- [ ] **Step 2: Build check**

Run:
```bash
cd kingdom-kids && npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/types.ts
git commit -m "feat: extend Student type with ID issuance fields"
```

---

## Task 3: Sunday Streak Utility — Failing Tests

**Files:**
- Create: `kingdom-kids/utils/sundayStreak.ts`
- Create: `kingdom-kids/__tests__/sundayStreak.test.ts`

- [ ] **Step 1: Create stub**

Create `kingdom-kids/utils/sundayStreak.ts`:
```typescript
export function getLastNSundays(from: Date, n: number): string[] {
  throw new Error('not implemented');
}

export function computeConsecutiveStreak(
  attendedDates: string[],
  from: Date,
  maxStreak: number = 4
): number {
  throw new Error('not implemented');
}

export function sundaysInMonth(year: number, month: number): string[] {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Write tests**

Create `kingdom-kids/__tests__/sundayStreak.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run — expect failure**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/sundayStreak.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/utils/sundayStreak.ts kingdom-kids/__tests__/sundayStreak.test.ts
git commit -m "test: sundayStreak failing tests"
```

---

## Task 4: Implement Sunday Streak

**Files:**
- Modify: `kingdom-kids/utils/sundayStreak.ts`

- [ ] **Step 1: Implement**

Replace file:
```typescript
function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastSundayOnOrBefore(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = out.getUTCDay(); // 0 = Sunday
  out.setUTCDate(out.getUTCDate() - dow);
  return out;
}

export function getLastNSundays(from: Date, n: number): string[] {
  const result: string[] = [];
  let cursor = lastSundayOnOrBefore(from);
  for (let i = 0; i < n; i++) {
    result.push(toISO(cursor));
    cursor = new Date(cursor.getTime());
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return result;
}

export function computeConsecutiveStreak(
  attendedDates: string[],
  from: Date,
  maxStreak: number = 4
): number {
  const attended = new Set(attendedDates);
  const sundays = getLastNSundays(from, maxStreak);
  let streak = 0;
  for (const s of sundays) {
    if (attended.has(s)) streak++;
    else break;
  }
  return streak;
}

export function sundaysInMonth(year: number, month: number): string[] {
  const result: string[] = [];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dow = first.getUTCDay();
  const firstSundayDate = 1 + ((7 - dow) % 7);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = firstSundayDate; d <= daysInMonth; d += 7) {
    result.push(toISO(new Date(Date.UTC(year, month - 1, d))));
  }
  return result;
}
```

- [ ] **Step 2: Run — expect pass**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/sundayStreak.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/utils/sundayStreak.ts
git commit -m "feat: implement sundayStreak utility"
```

---

## Task 5: Bucket Categorization — TDD

**Files:**
- Create: `kingdom-kids/__tests__/bucketCategorization.test.ts`
- Create: `kingdom-kids/utils/idBuckets.ts`

- [ ] **Step 1: Create stub**

Create `kingdom-kids/utils/idBuckets.ts`:
```typescript
export type Bucket = 'HAS_ID' | 'NEEDS_REPRINT' | 'QUALIFIED' | 'NOT_YET';

export interface StudentStatusInput {
  idIssuedAt: string | null;
  idNeedsReprint: boolean;
  streak: number;
}

export function categorize(s: StudentStatusInput, minStreak: number = 4): Bucket {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Write tests**

Create `kingdom-kids/__tests__/bucketCategorization.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run — expect failure**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/bucketCategorization.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement**

Replace `kingdom-kids/utils/idBuckets.ts`:
```typescript
export type Bucket = 'HAS_ID' | 'NEEDS_REPRINT' | 'QUALIFIED' | 'NOT_YET';

export interface StudentStatusInput {
  idIssuedAt: string | null;
  idNeedsReprint: boolean;
  streak: number;
}

export function categorize(s: StudentStatusInput, minStreak: number = 4): Bucket {
  if (s.idNeedsReprint) return 'NEEDS_REPRINT';
  if (s.idIssuedAt) return 'HAS_ID';
  if (s.streak >= minStreak) return 'QUALIFIED';
  return 'NOT_YET';
}
```

- [ ] **Step 5: Run — expect pass**

Run:
```bash
cd kingdom-kids && npx vitest run __tests__/bucketCategorization.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kingdom-kids/utils/idBuckets.ts kingdom-kids/__tests__/bucketCategorization.test.ts
git commit -m "feat: categorize students into ID buckets"
```

---

## Task 6: DB Service — ID Functions

**Files:**
- Modify: `kingdom-kids/services/db.service.ts`

- [ ] **Step 1: Append ID issuance functions**

Append to `kingdom-kids/services/db.service.ts`:
```typescript
// ============================================================
// ID Issuance functions
// ============================================================

export interface StudentWithStreak {
  id: string;
  fullName: string;
  ageGroup: string;
  accessKey: string;
  idIssuedAt: string | null;
  idNeedsReprint: boolean;
  idReprintCount: number;
  idLastLostAt: string | null;
  streak: number;
  attendedDates: string[];
}

import { computeConsecutiveStreak } from '../utils/sundayStreak';

export async function getStudentsWithAttendanceStreak(from: Date = new Date()): Promise<StudentWithStreak[]> {
  const { data: studs, error: sErr } = await supabase
    .from('students')
    .select('id, fullName, ageGroup, accessKey, id_issued_at, id_needs_reprint, id_reprint_count, id_last_lost_at')
    .eq('studentStatus', 'active');
  if (sErr) throw sErr;

  const { data: sess, error: aErr } = await supabase
    .from('attendance_sessions')
    .select('studentId, sessionDate')
    .eq('status', 'CLOSED');
  if (aErr) throw aErr;

  const byStudent = new Map<string, string[]>();
  (sess || []).forEach((r: any) => {
    const arr = byStudent.get(r.studentId) || [];
    arr.push(r.sessionDate);
    byStudent.set(r.studentId, arr);
  });

  return (studs || []).map((s: any) => {
    const attendedDates = byStudent.get(s.id) || [];
    return {
      id: s.id,
      fullName: s.fullName,
      ageGroup: s.ageGroup,
      accessKey: s.accessKey,
      idIssuedAt: s.id_issued_at,
      idNeedsReprint: s.id_needs_reprint || false,
      idReprintCount: s.id_reprint_count || 0,
      idLastLostAt: s.id_last_lost_at,
      streak: computeConsecutiveStreak(attendedDates, from, 4),
      attendedDates,
    };
  });
}

export async function setIdIssued(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      id_issued_at: new Date().toISOString(),
      id_needs_reprint: false,
    })
    .eq('id', studentId);
  if (error) throw error;
  await logAudit('ID_ISSUED', studentId);
}

export async function markIdLost(studentId: string): Promise<void> {
  const { data: current, error: fErr } = await supabase
    .from('students')
    .select('id_reprint_count')
    .eq('id', studentId)
    .single();
  if (fErr) throw fErr;

  const { error } = await supabase
    .from('students')
    .update({
      id_needs_reprint: true,
      id_last_lost_at: new Date().toISOString(),
      id_reprint_count: (current?.id_reprint_count || 0) + 1,
    })
    .eq('id', studentId);
  if (error) throw error;
  await logAudit('ID_MARKED_LOST', studentId);
}

export async function completeReprint(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      id_needs_reprint: false,
      id_issued_at: new Date().toISOString(),
    })
    .eq('id', studentId);
  if (error) throw error;
  await logAudit('ID_REPRINTED', studentId);
}

async function logAudit(eventType: string, studentId: string): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      eventType,
      actor: 'ADMIN',
      entityId: studentId,
      payload: {},
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/services/db.service.ts
git commit -m "feat: add ID issuance DB functions"
```

---

## Task 7: SummaryBar Component

**Files:**
- Create: `kingdom-kids/components/id-issuance/SummaryBar.tsx`

- [ ] **Step 1: Create**

Create `kingdom-kids/components/id-issuance/SummaryBar.tsx`:
```typescript
import React from 'react';
import type { Bucket } from '../../utils/idBuckets';

interface Props {
  counts: Record<Bucket, number>;
  active: Bucket;
  onChange: (b: Bucket) => void;
}

const LABELS: Record<Bucket, { label: string; color: string }> = {
  HAS_ID: { label: 'Has ID', color: 'bg-green-100 text-green-800 border-green-300' },
  NEEDS_REPRINT: { label: 'Needs Reprint', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  QUALIFIED: { label: 'Qualified', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  NOT_YET: { label: 'Not Yet', color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const ORDER: Bucket[] = ['HAS_ID', 'NEEDS_REPRINT', 'QUALIFIED', 'NOT_YET'];

const SummaryBar: React.FC<Props> = ({ counts, active, onChange }) => (
  <div className="grid grid-cols-4 gap-3 mb-6">
    {ORDER.map(b => {
      const meta = LABELS[b];
      const isActive = active === b;
      return (
        <button
          key={b}
          onClick={() => onChange(b)}
          className={`p-4 rounded-lg border-2 text-left transition ${meta.color} ${isActive ? 'ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100'}`}
        >
          <div className="text-xs font-bold uppercase tracking-wide">{meta.label}</div>
          <div className="text-3xl font-black mt-1">{counts[b] || 0}</div>
        </button>
      );
    })}
  </div>
);

export default SummaryBar;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/id-issuance/SummaryBar.tsx
git commit -m "feat: SummaryBar for ID issuance buckets"
```

---

## Task 8: StudentCard Component

**Files:**
- Create: `kingdom-kids/components/id-issuance/StudentCard.tsx`

- [ ] **Step 1: Create**

Create `kingdom-kids/components/id-issuance/StudentCard.tsx`:
```typescript
import React from 'react';
import type { StudentWithStreak } from '../../services/db.service';
import type { Bucket } from '../../utils/idBuckets';

interface Props {
  student: StudentWithStreak;
  bucket: Bucket;
  onMarkLost: (id: string) => void;
  onIssue: (id: string) => void;
  onCompleteReprint: (id: string) => void;
}

const StudentCard: React.FC<Props> = ({ student, bucket, onMarkLost, onIssue, onCompleteReprint }) => {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold">{student.fullName}</div>
          <div className="text-xs text-slate-500">{student.ageGroup} · Key: {student.accessKey}</div>
        </div>
        <div className="text-right text-xs">
          {bucket === 'NOT_YET' && <span className="bg-slate-100 px-2 py-0.5 rounded">Streak: {student.streak}/4</span>}
          {bucket === 'QUALIFIED' && <span className="bg-yellow-100 px-2 py-0.5 rounded">Eligible</span>}
          {bucket === 'HAS_ID' && student.idIssuedAt && (
            <span className="text-slate-500">Issued {new Date(student.idIssuedAt).toLocaleDateString()}</span>
          )}
          {bucket === 'NEEDS_REPRINT' && student.idLastLostAt && (
            <span className="text-orange-600">Lost {new Date(student.idLastLostAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {student.idReprintCount > 0 && (
        <div className="text-[10px] text-slate-400 mt-1">Reprints: {student.idReprintCount}x</div>
      )}

      <div className="mt-3 flex gap-2">
        {bucket === 'QUALIFIED' && (
          <button onClick={() => onIssue(student.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">
            Issue ID
          </button>
        )}
        {bucket === 'HAS_ID' && (
          <button onClick={() => onMarkLost(student.id)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded">
            Mark Lost
          </button>
        )}
        {bucket === 'NEEDS_REPRINT' && (
          <button onClick={() => onCompleteReprint(student.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded">
            Complete Reprint
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentCard;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/id-issuance/StudentCard.tsx
git commit -m "feat: StudentCard with bucket-specific actions"
```

---

## Task 9: ScanResultToast Component

**Files:**
- Create: `kingdom-kids/components/id-issuance/ScanResultToast.tsx`

- [ ] **Step 1: Create**

Create `kingdom-kids/components/id-issuance/ScanResultToast.tsx`:
```typescript
import React, { useEffect } from 'react';

export type ScanResultKind = 'success' | 'warning' | 'error';

interface Props {
  kind: ScanResultKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

const BG: Record<ScanResultKind, string> = {
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  error: 'bg-red-600',
};

const ScanResultToast: React.FC<Props> = ({ kind, message, actionLabel, onAction, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 ${BG[kind]} text-white px-6 py-4 rounded-xl shadow-2xl z-50 max-w-md`}>
      <div className="flex items-center gap-4">
        <span className="flex-1">{message}</span>
        {actionLabel && onAction && (
          <button onClick={onAction} className="bg-white text-slate-900 px-3 py-1 rounded text-sm font-bold">
            {actionLabel}
          </button>
        )}
        <button onClick={onClose} className="opacity-70 hover:opacity-100">✕</button>
      </div>
    </div>
  );
};

export default ScanResultToast;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/id-issuance/ScanResultToast.tsx
git commit -m "feat: ScanResultToast"
```

---

## Task 10: ConfirmDialog Component

**Files:**
- Create: `kingdom-kids/components/id-issuance/ConfirmDialog.tsx`

- [ ] **Step 1: Create**

Create `kingdom-kids/components/id-issuance/ConfirmDialog.tsx`:
```typescript
import React from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<Props> = ({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-slate-700 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/id-issuance/ConfirmDialog.tsx
git commit -m "feat: ConfirmDialog"
```

---

## Task 11: Locate Existing QR Scanner

**Files:** (read only)

- [ ] **Step 1: Find scanner component**

Run:
```bash
grep -rn "qr-scanner\|jsQR\|BrowserQRCodeReader" kingdom-kids/ --include="*.ts*" | head -10
```

Note which library is used and which component to reuse.

- [ ] **Step 2: Inspect QRScanPage**

Run:
```bash
head -50 kingdom-kids/pages/QRScanPage.tsx
```

Identify reusable scanner component or inline implementation.

- [ ] **Step 3: If scanner is inline, extract to reusable component**

If QR scanning is inline in `QRScanPage.tsx`, extract scan hook/component to `kingdom-kids/components/shared/QrReader.tsx` with interface:
```typescript
interface Props {
  onScan: (text: string) => void;
  onError?: (err: string) => void;
}
```

Replace inline scanner usage in QRScanPage with `<QrReader ... />` — verify attendance scan still works.

If already reusable, skip extraction.

- [ ] **Step 4: Commit (if refactor needed)**

```bash
git add kingdom-kids/components/shared/QrReader.tsx kingdom-kids/pages/QRScanPage.tsx
git commit -m "refactor: extract reusable QrReader component"
```

---

## Task 12: IdIssuancePage — Main Page

**Files:**
- Create: `kingdom-kids/pages/IdIssuancePage.tsx`

- [ ] **Step 1: Create page**

Create `kingdom-kids/pages/IdIssuancePage.tsx`:
```typescript
import React, { useState, useEffect, useMemo } from 'react';
import SummaryBar from '../components/id-issuance/SummaryBar';
import StudentCard from '../components/id-issuance/StudentCard';
import ScanResultToast, { ScanResultKind } from '../components/id-issuance/ScanResultToast';
import ConfirmDialog from '../components/id-issuance/ConfirmDialog';
import QrReader from '../components/shared/QrReader';
import {
  getStudentsWithAttendanceStreak,
  setIdIssued,
  markIdLost,
  completeReprint,
  StudentWithStreak,
} from '../services/db.service';
import { categorize, Bucket } from '../utils/idBuckets';

const IdIssuancePage: React.FC = () => {
  const [students, setStudents] = useState<StudentWithStreak[]>([]);
  const [activeBucket, setActiveBucket] = useState<Bucket>('QUALIFIED');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: ScanResultKind; message: string; action?: { label: string; fn: () => void } } | null>(null);
  const [dialog, setDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getStudentsWithAttendanceStreak(new Date());
      setStudents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const out: Record<Bucket, StudentWithStreak[]> = { HAS_ID: [], NEEDS_REPRINT: [], QUALIFIED: [], NOT_YET: [] };
    for (const s of students) {
      const b = categorize(s);
      out[b].push(s);
    }
    out.QUALIFIED.sort((a, b) => (b.attendedDates.slice(-1)[0] || '').localeCompare(a.attendedDates.slice(-1)[0] || ''));
    out.HAS_ID.sort((a, b) => (b.idIssuedAt || '').localeCompare(a.idIssuedAt || ''));
    out.NEEDS_REPRINT.sort((a, b) => (b.idLastLostAt || '').localeCompare(a.idLastLostAt || ''));
    out.NOT_YET.sort((a, b) => b.streak - a.streak);
    return out;
  }, [students]);

  const counts = useMemo(() => ({
    HAS_ID: grouped.HAS_ID.length,
    NEEDS_REPRINT: grouped.NEEDS_REPRINT.length,
    QUALIFIED: grouped.QUALIFIED.length,
    NOT_YET: grouped.NOT_YET.length,
  }), [grouped]);

  const handleIssue = (id: string) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    setDialog({
      title: 'Issue ID',
      message: `Issue ID card to ${s.fullName}?`,
      onConfirm: async () => {
        setDialog(null);
        try {
          await setIdIssued(id);
          setToast({ kind: 'success', message: `ID issued to ${s.fullName}` });
          await load();
        } catch (e: any) {
          setToast({ kind: 'error', message: `Failed: ${e?.message || e}` });
        }
      },
    });
  };

  const handleMarkLost = (id: string) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    setDialog({
      title: 'Mark ID Lost',
      message: `Mark ${s.fullName}'s ID as lost? They will need a new card.`,
      onConfirm: async () => {
        setDialog(null);
        try {
          await markIdLost(id);
          setToast({ kind: 'warning', message: `${s.fullName} marked lost — print new card` });
          await load();
        } catch (e: any) {
          setToast({ kind: 'error', message: `Failed: ${e?.message || e}` });
        }
      },
    });
  };

  const handleCompleteReprint = (id: string) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    setDialog({
      title: 'Complete Reprint',
      message: `Confirm new ID delivered to ${s.fullName}?`,
      onConfirm: async () => {
        setDialog(null);
        try {
          await completeReprint(id);
          setToast({ kind: 'success', message: `Reprint complete for ${s.fullName}` });
          await load();
        } catch (e: any) {
          setToast({ kind: 'error', message: `Failed: ${e?.message || e}` });
        }
      },
    });
  };

  const handleScan = (accessKey: string) => {
    const s = students.find(x => x.accessKey === accessKey);
    if (!s) {
      setToast({ kind: 'error', message: `Unknown QR code: ${accessKey}` });
      return;
    }
    const b = categorize(s);
    if (b === 'QUALIFIED') handleIssue(s.id);
    else if (b === 'NEEDS_REPRINT') handleCompleteReprint(s.id);
    else if (b === 'HAS_ID') {
      setToast({
        kind: 'warning',
        message: `${s.fullName} already has ID (issued ${s.idIssuedAt ? new Date(s.idIssuedAt).toLocaleDateString() : '?'})`,
        action: { label: 'Mark Lost', fn: () => { setToast(null); handleMarkLost(s.id); } },
      });
    } else {
      setToast({ kind: 'error', message: `${s.fullName}: only ${s.streak}/4 consecutive — not eligible yet` });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Issuance Monitor</h1>

      <SummaryBar counts={counts} active={activeBucket} onChange={setActiveBucket} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : grouped[activeBucket].length === 0 ? (
            <p className="text-slate-500">No students in this bucket</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[activeBucket].map(s => (
                <StudentCard
                  key={s.id}
                  student={s}
                  bucket={activeBucket}
                  onIssue={handleIssue}
                  onMarkLost={handleMarkLost}
                  onCompleteReprint={handleCompleteReprint}
                />
              ))}
            </div>
          )}
        </div>

        <div className="col-span-1 sticky top-6 self-start">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="font-bold mb-2">Scan QR to Tag</h3>
            <QrReader onScan={handleScan} />
            <p className="text-xs text-slate-500 mt-2">Scan student ID QR to auto-tag based on status.</p>
          </div>
        </div>
      </div>

      {toast && (
        <ScanResultToast
          kind={toast.kind}
          message={toast.message}
          actionLabel={toast.action?.label}
          onAction={toast.action?.fn}
          onClose={() => setToast(null)}
        />
      )}
      {dialog && (
        <ConfirmDialog
          open
          title={dialog.title}
          message={dialog.message}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default IdIssuancePage;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/pages/IdIssuancePage.tsx
git commit -m "feat: IdIssuancePage orchestrator with scan-to-tag"
```

---

## Task 13: Add Route + Admin Nav Link

**Files:**
- Modify: `kingdom-kids/App.tsx`
- Modify: `kingdom-kids/pages/AdminDashboard.tsx` (or main admin nav component)

- [ ] **Step 1: Import + add route**

In `kingdom-kids/App.tsx`, add import:
```typescript
import IdIssuancePage from './pages/IdIssuancePage';
```

Add route (match pattern of other admin-gated routes):
```tsx
<Route
  path="/admin/id-issuance"
  element={session?.role === 'ADMIN' ? <IdIssuancePage /> : <Navigate to="/" />}
/>
```

- [ ] **Step 2: Add nav link in admin dashboard**

In admin nav, add:
```tsx
<Link to="/admin/id-issuance" className="px-4 py-2 bg-indigo-600 text-white rounded">
  ID Issuance
</Link>
```

- [ ] **Step 3: Build check**

Run:
```bash
cd kingdom-kids && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/App.tsx kingdom-kids/pages/AdminDashboard.tsx
git commit -m "feat: wire /admin/id-issuance route and nav link"
```

---

## Task 14: Manual E2E Smoke Test

**Files:** none

- [ ] **Step 1: Run DB migration**

In Supabase SQL Editor, run `supabase-migrations/2026-04-24-id-issuance-columns.sql`.

- [ ] **Step 2: Seed test data**

In SQL Editor:
```sql
-- Pick 2 existing students with 4+ attendance records to test Qualified
-- Verify they have attendance_sessions for last 4 Sundays
SELECT s.id, s."fullName", COUNT(a.*) AS sessions
FROM students s
LEFT JOIN attendance_sessions a ON a."studentId" = s.id AND a.status = 'CLOSED'
GROUP BY s.id, s."fullName"
ORDER BY sessions DESC
LIMIT 5;
```

- [ ] **Step 3: Login as ADMIN, open /admin/id-issuance**

Verify: 4 bucket cards visible, counts populate.

- [ ] **Step 4: Click "Qualified" bucket → "Issue ID" on a student**

Verify: confirm dialog → confirm → success toast → student moves to "Has ID".

- [ ] **Step 5: Click "Has ID" → "Mark Lost" on same student**

Verify: moves to "Needs Reprint", reprint count = 1.

- [ ] **Step 6: Click "Needs Reprint" → "Complete Reprint"**

Verify: moves back to "Has ID", idIssuedAt refreshed.

- [ ] **Step 7: Test QR scan flow**

Print accessKey QR for a Qualified student, scan via page camera:
Expected: auto-opens confirm dialog.

- [ ] **Step 8: Test scan edge cases**

- Scan unknown accessKey → red toast "Unknown QR"
- Scan Not-Yet student → red toast with streak count
- Scan Has-ID student → yellow toast with "Mark Lost" action

- [ ] **Step 9: Verify audit log**

```sql
SELECT * FROM audit_log WHERE "eventType" IN ('ID_ISSUED', 'ID_MARKED_LOST', 'ID_REPRINTED') ORDER BY "createdAt" DESC LIMIT 10;
```

Expected: entries match test actions.

- [ ] **Step 10: Commit E2E notes**

```bash
git commit --allow-empty -m "test: manual E2E smoke pass for ID issuance"
```

---

## Self-Review Results

- [x] **Spec coverage:** All bullets covered — DB schema (Task 1), streak logic (Tasks 3-4), bucket logic (Task 5), DB functions (Task 6), 4 UI components (Tasks 7-10), QR scanner reuse (Task 11), page orchestrator (Task 12), route (Task 13), E2E (Task 14)
- [x] **Placeholder scan:** No TBDs, all code complete
- [x] **Type consistency:** `StudentWithStreak`, `Bucket`, `ScanResultKind`, `Resolution` used consistently

---

## Execution Handoff

Plan complete. After running, proceed to Plan C (Faith Pathway Migration).
