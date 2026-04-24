# Faith Pathway Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge standalone `kk-faith-pathway` app into `kingdom-kids`. Migrate data to single Supabase instance, convert hash routing to React Router, remove duplicate login, add featured lesson with weekly activity template on home dashboard.

**Architecture:** Data migration via JSON export → kingdom-kids Supabase import. Code merge: copy views → pages with `/faith-pathway/*` routes, gate by existing auth. New `featured_lessons` table + weekly activity template (Bible Stories / Memory Verse / Games & Quiz / Arts / Scripture Quest). Home dashboard card shows current week's featured lesson.

**Tech Stack:** React 18 + TypeScript, React Router v6, Supabase, existing `xlsx`-free stack, existing Gemini service.

**Spec:** `docs/superpowers/specs/2026-04-24-faith-pathway-migration-design.md`

---

## File Structure

```
kingdom-kids/
├── supabase-migrations/
│   ├── 2026-04-24-faith-pathway-tables.sql           (create — lesson tables)
│   ├── 2026-04-24-faith-pathway-extensions.sql       (create — week_number, featured_lessons)
│   └── 2026-04-24-faith-pathway-data.sql             (create — data import SQL)
├── scripts/
│   ├── export-faith-pathway.ts                        (create — one-time export script)
│   └── import-faith-pathway.ts                        (create — one-time import script)
├── types.ts                                            (modify — add Lesson types)
├── utils/
│   ├── featuredWeek.ts                                 (create — week number calc)
│   └── lessonMarkdown.ts                               (create — parse READ/TEACH/ENGAGE)
├── services/
│   ├── lessons.service.ts                              (create — CRUD for lessons/featured)
│   └── gemini-lesson.service.ts                        (create — Gemini lesson AI)
├── pages/
│   ├── FaithPathwayTeacherPage.tsx                     (create — copy of TeacherDashboard)
│   ├── FaithPathwayAdminPage.tsx                       (create — admin CRUD + featured)
│   └── FaithPathwayLessonPage.tsx                      (create — lesson detail)
├── components/faith-pathway/
│   ├── ActivityCard.tsx                                (create — copied + week badge)
│   ├── LessonTextTab.tsx                               (create — copied)
│   ├── VideoEmbed.tsx                                  (create — copied)
│   ├── FeaturedLessonCard.tsx                          (create — dashboard widget)
│   └── FeaturedLessonManager.tsx                       (create — admin pin UI)
├── App.tsx                                             (modify — add /faith-pathway/* routes)
├── pages/Dashboard.tsx                                 (modify — embed FeaturedLessonCard)
└── __tests__/
    └── featuredWeek.test.ts                            (create)
```

---

## Task 1: Create Lesson Tables in kingdom-kids Supabase

**Files:**
- Create: `kingdom-kids/supabase-migrations/2026-04-24-faith-pathway-tables.sql`

- [ ] **Step 1: Create migration SQL**

Create `kingdom-kids/supabase-migrations/2026-04-24-faith-pathway-tables.sql`:
```sql
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  category TEXT,
  series TEXT,
  grade_min INT,
  grade_max INT,
  tags TEXT[],
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lesson_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  provider TEXT,
  title TEXT
);

CREATE TABLE IF NOT EXISTS lesson_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  supplies TEXT[],
  instructions TEXT,
  duration_minutes INT
);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  storage_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (lesson_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_lesson_videos_lesson_id ON lesson_videos(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson_id ON lesson_activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_attachments_lesson_id ON attachments(lesson_id);
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/supabase-migrations/2026-04-24-faith-pathway-tables.sql
git commit -m "feat: faith-pathway table migrations"
```

---

## Task 2: Schema Extensions (week_number, featured_lessons)

**Files:**
- Create: `kingdom-kids/supabase-migrations/2026-04-24-faith-pathway-extensions.sql`

- [ ] **Step 1: Create SQL**

Create `kingdom-kids/supabase-migrations/2026-04-24-faith-pathway-extensions.sql`:
```sql
ALTER TABLE lesson_activities
  ADD COLUMN IF NOT EXISTS week_number   INT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS activity_type VARCHAR DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_activities_week ON lesson_activities(lesson_id, week_number);

CREATE TABLE IF NOT EXISTS featured_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  theme TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_featured_lessons_date_range ON featured_lessons(start_date, end_date);
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/supabase-migrations/2026-04-24-faith-pathway-extensions.sql
git commit -m "feat: faith-pathway schema extensions (week_number, featured_lessons)"
```

---

## Task 3: Export Script — Old Supabase to JSON

**Files:**
- Create: `kingdom-kids/scripts/export-faith-pathway.ts`

- [ ] **Step 1: Create script**

Create `kingdom-kids/scripts/export-faith-pathway.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const OLD_URL = process.env.FP_OLD_URL!;
const OLD_KEY = process.env.FP_OLD_KEY!;

if (!OLD_URL || !OLD_KEY) {
  console.error('Set FP_OLD_URL and FP_OLD_KEY env vars');
  process.exit(1);
}

const sb = createClient(OLD_URL, OLD_KEY);

async function exportTable(name: string): Promise<any[]> {
  const { data, error } = await sb.from(name).select('*');
  if (error) throw error;
  console.log(`  ${name}: ${data?.length || 0} rows`);
  return data || [];
}

async function main() {
  const tables = ['lessons', 'lesson_videos', 'lesson_activities', 'attachments', 'lesson_progress'];
  const out: Record<string, any[]> = {};
  for (const t of tables) out[t] = await exportTable(t);

  const outPath = path.resolve(__dirname, '../faith-pathway-export.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`Totals: ${Object.entries(out).map(([k, v]) => `${k}=${v.length}`).join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add npm script**

Modify `kingdom-kids/package.json` — add to `scripts`:
```json
"fp:export": "tsx scripts/export-faith-pathway.ts",
"fp:import": "tsx scripts/import-faith-pathway.ts"
```

Install tsx if not present:
```bash
cd kingdom-kids && npm install -D tsx
```

- [ ] **Step 3: Run export**

```bash
cd kingdom-kids && FP_OLD_URL=https://wfjhmimqntryohnrmuxc.supabase.co FP_OLD_KEY=<old_anon_key> npm run fp:export
```

Expected: `faith-pathway-export.json` created with row counts logged.

- [ ] **Step 4: Verify counts**

Manually inspect JSON — record counts per table for later verification.

- [ ] **Step 5: Commit (exclude JSON from repo)**

Add to `kingdom-kids/.gitignore`:
```
faith-pathway-export.json
```

```bash
git add kingdom-kids/scripts/export-faith-pathway.ts kingdom-kids/package.json kingdom-kids/.gitignore
git commit -m "feat: faith-pathway export script"
```

---

## Task 4: Import Script — JSON to kingdom-kids Supabase

**Files:**
- Create: `kingdom-kids/scripts/import-faith-pathway.ts`

- [ ] **Step 1: Create script**

Create `kingdom-kids/scripts/import-faith-pathway.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const NEW_URL = process.env.KK_URL!;
const NEW_KEY = process.env.KK_SERVICE_KEY!;

if (!NEW_URL || !NEW_KEY) {
  console.error('Set KK_URL and KK_SERVICE_KEY env vars (service role key required for insert)');
  process.exit(1);
}

const sb = createClient(NEW_URL, NEW_KEY);

async function importTable(name: string, rows: any[]): Promise<void> {
  if (rows.length === 0) {
    console.log(`  ${name}: 0 rows (skip)`);
    return;
  }
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from(name).insert(slice);
    if (error) {
      console.error(`Error importing ${name} chunk ${i}:`, error);
      throw error;
    }
  }
  console.log(`  ${name}: imported ${rows.length} rows`);
}

async function verifyTable(name: string, expected: number): Promise<void> {
  const { count, error } = await sb.from(name).select('*', { count: 'exact', head: true });
  if (error) throw error;
  const ok = count === expected;
  console.log(`  ${name}: DB count=${count}, expected=${expected} ${ok ? 'OK' : 'MISMATCH'}`);
  if (!ok) throw new Error(`${name} count mismatch`);
}

async function main() {
  const jsonPath = path.resolve(__dirname, '../faith-pathway-export.json');
  const data: Record<string, any[]> = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const order = ['lessons', 'lesson_videos', 'lesson_activities', 'attachments', 'lesson_progress'];
  console.log('Importing...');
  for (const t of order) await importTable(t, data[t] || []);

  console.log('\nVerifying...');
  for (const t of order) await verifyTable(t, (data[t] || []).length);

  console.log('\nImport complete');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run migrations in Supabase SQL Editor first**

Run in kingdom-kids Supabase SQL Editor:
1. `supabase-migrations/2026-04-24-faith-pathway-tables.sql`
2. `supabase-migrations/2026-04-24-faith-pathway-extensions.sql`

- [ ] **Step 3: Run import**

```bash
cd kingdom-kids && KK_URL=https://ewlvfgfvxauxqfruyfoz.supabase.co KK_SERVICE_KEY=<service_role_key> npm run fp:import
```

Expected: all tables imported with row counts matching export.

**Warning:** Requires Supabase service role key (not anon). Do NOT commit the key.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/scripts/import-faith-pathway.ts
git commit -m "feat: faith-pathway import script"
```

---

## Task 5: Types — Lesson Interfaces

**Files:**
- Modify: `kingdom-kids/types.ts`

- [ ] **Step 1: Add lesson types**

Append to `kingdom-kids/types.ts`:
```typescript
export enum LessonStatus { DRAFT = 'DRAFT', PUBLISHED = 'PUBLISHED' }

export interface LessonActivity {
  id: string;
  lesson_id: string;
  title: string;
  supplies: string[];
  instructions: string;
  duration_minutes: number;
  week_number?: number | null;
  activity_type?: string | null;
}

export interface LessonVideo {
  id: string;
  lesson_id: string;
  url: string;
  provider?: string;
  title?: string;
}

export interface Attachment {
  id: string;
  lesson_id: string;
  name: string;
  type: string;
  storage_path: string;
}

export interface LessonProgress {
  id: string;
  lesson_id: string;
  teacher_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface Lesson {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  series?: string;
  grade_min?: number;
  grade_max?: number;
  tags?: string[];
  status: LessonStatus;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  activities?: LessonActivity[];
  videos?: LessonVideo[];
  attachments?: Attachment[];
  progress?: LessonProgress;
}

export interface FeaturedLesson {
  id: string;
  lesson_id: string;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  theme?: string;
  created_by?: string;
  created_at?: string;
}

export interface LessonContentStructure {
  read: Array<{ id: string; title: string; content: string }>;
  teach: Array<{ id: string; title: string; content: string }>;
  engage: Array<{ id: string; title: string; content: string }>;
}
```

- [ ] **Step 2: Build check**

```bash
cd kingdom-kids && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/types.ts
git commit -m "feat: lesson types in kingdom-kids"
```

---

## Task 6: Featured Week Utility — TDD

**Files:**
- Create: `kingdom-kids/utils/featuredWeek.ts`
- Create: `kingdom-kids/__tests__/featuredWeek.test.ts`

- [ ] **Step 1: Stub**

Create `kingdom-kids/utils/featuredWeek.ts`:
```typescript
export const WEEK_TEMPLATE: Record<number, string> = {
  1: 'Bible Stories',
  2: 'Memory Verse',
  3: 'GAMES & QUIZ',
  4: 'Arts / Made by Tiny Hands',
  5: 'Scripture Quest: A Fun Bible Quiz & Memory Verse Day',
};

export function getDefaultActivityType(weekNumber: number): string {
  throw new Error('not implemented');
}

export function computeCurrentWeekNumber(startDate: string, today: Date): number {
  throw new Error('not implemented');
}

export function monthHas5Sundays(year: number, month: number): boolean {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Write tests**

Create `kingdom-kids/__tests__/featuredWeek.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getDefaultActivityType, computeCurrentWeekNumber, monthHas5Sundays, WEEK_TEMPLATE } from '../utils/featuredWeek';

describe('getDefaultActivityType', () => {
  it('returns Bible Stories for week 1', () => {
    expect(getDefaultActivityType(1)).toBe('Bible Stories');
  });
  it('returns Memory Verse for week 2', () => {
    expect(getDefaultActivityType(2)).toBe('Memory Verse');
  });
  it('returns GAMES & QUIZ for week 3', () => {
    expect(getDefaultActivityType(3)).toBe('GAMES & QUIZ');
  });
  it('returns Arts for week 4', () => {
    expect(getDefaultActivityType(4)).toBe('Arts / Made by Tiny Hands');
  });
  it('returns Scripture Quest for week 5', () => {
    expect(getDefaultActivityType(5)).toBe('Scripture Quest: A Fun Bible Quiz & Memory Verse Day');
  });
});

describe('computeCurrentWeekNumber', () => {
  it('returns 1 when today is start_date', () => {
    expect(computeCurrentWeekNumber('2026-04-05', new Date('2026-04-05T12:00:00Z'))).toBe(1);
  });
  it('returns 2 when 7 days after start', () => {
    expect(computeCurrentWeekNumber('2026-04-05', new Date('2026-04-12T12:00:00Z'))).toBe(2);
  });
  it('returns 4 when 21 days after start', () => {
    expect(computeCurrentWeekNumber('2026-04-05', new Date('2026-04-26T12:00:00Z'))).toBe(4);
  });
  it('clamps to 5 max', () => {
    expect(computeCurrentWeekNumber('2026-04-05', new Date('2026-06-01T12:00:00Z'))).toBe(5);
  });
  it('returns 1 if today before start', () => {
    expect(computeCurrentWeekNumber('2026-04-05', new Date('2026-04-01T12:00:00Z'))).toBe(1);
  });
});

describe('monthHas5Sundays', () => {
  it('April 2026 has 4 Sundays', () => {
    expect(monthHas5Sundays(2026, 4)).toBe(false);
  });
  it('March 2026 has 5 Sundays', () => {
    expect(monthHas5Sundays(2026, 3)).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
cd kingdom-kids && npx vitest run __tests__/featuredWeek.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement**

Replace `kingdom-kids/utils/featuredWeek.ts`:
```typescript
export const WEEK_TEMPLATE: Record<number, string> = {
  1: 'Bible Stories',
  2: 'Memory Verse',
  3: 'GAMES & QUIZ',
  4: 'Arts / Made by Tiny Hands',
  5: 'Scripture Quest: A Fun Bible Quiz & Memory Verse Day',
};

export function getDefaultActivityType(weekNumber: number): string {
  return WEEK_TEMPLATE[weekNumber] || 'Bible Stories';
}

export function computeCurrentWeekNumber(startDate: string, today: Date): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const diffMs = today.getTime() - start.getTime();
  if (diffMs < 0) return 1;
  const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(5, weeks));
}

export function monthHas5Sundays(year: number, month: number): boolean {
  let count = 0;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) count++;
  }
  return count === 5;
}
```

- [ ] **Step 5: Run — expect pass**

```bash
cd kingdom-kids && npx vitest run __tests__/featuredWeek.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kingdom-kids/utils/featuredWeek.ts kingdom-kids/__tests__/featuredWeek.test.ts
git commit -m "feat: featuredWeek utility with template"
```

---

## Task 7: Lesson Markdown Parser

**Files:**
- Create: `kingdom-kids/utils/lessonMarkdown.ts`

- [ ] **Step 1: Create — copied from faith-pathway**

Create `kingdom-kids/utils/lessonMarkdown.ts`:
```typescript
import type { LessonContentStructure } from '../types';

export function parseMarkdownToStructure(md: string): LessonContentStructure {
  const structure: LessonContentStructure = { read: [], teach: [], engage: [] };
  if (!md) return structure;

  const mainSections = md.split(/^# \d\. /m);
  const pillars = ['read', 'teach', 'engage'] as const;

  pillars.forEach((key, i) => {
    const fullBlock = mainSections[i + 1] || '';
    const parts = fullBlock.split(/^## /m);
    structure[key] = parts.slice(1).filter(s => s.trim()).map((s, idx) => {
      const lines = s.split('\n');
      return {
        id: `${key}-sub-${idx}`,
        title: lines[0].trim(),
        content: lines.slice(1).join('\n').trim(),
      };
    });
  });

  return structure;
}
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/utils/lessonMarkdown.ts
git commit -m "feat: lessonMarkdown parser"
```

---

## Task 8: Lessons Service — CRUD + Featured

**Files:**
- Create: `kingdom-kids/services/lessons.service.ts`

- [ ] **Step 1: Create service**

Create `kingdom-kids/services/lessons.service.ts`:
```typescript
import { supabase } from './supabase';
import type { Lesson, LessonActivity, FeaturedLesson, UserRole } from '../types';
import { LessonStatus } from '../types';
import { getDefaultActivityType } from '../utils/featuredWeek';

export const lessons = {
  async list(role: 'ADMIN' | 'TEACHER'): Promise<Lesson[]> {
    let q = supabase.from('lessons').select('*, lesson_videos(*), lesson_activities(*), attachments(*)');
    if (role === 'TEACHER') q = q.eq('status', LessonStatus.PUBLISHED);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(row => ({
      ...row,
      videos: row.lesson_videos || [],
      activities: row.lesson_activities || [],
      attachments: row.attachments || [],
    })) as Lesson[];
  },

  async get(id: string): Promise<Lesson> {
    const { data, error } = await supabase
      .from('lessons')
      .select('*, lesson_videos(*), lesson_activities(*), attachments(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return {
      ...data,
      videos: data.lesson_videos || [],
      activities: data.lesson_activities || [],
      attachments: data.attachments || [],
    } as Lesson;
  },

  async upsert(lesson: Partial<Lesson>): Promise<Lesson> {
    const { lesson_videos, lesson_activities, attachments, videos, activities, ...payload } = lesson as any;
    const { data, error } = await supabase.from('lessons').upsert(payload).select().single();
    if (error) throw error;
    return data as Lesson;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (error) throw error;
  },
};

export const progress = {
  async get(lessonId: string, teacherId: string) {
    const { data } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('teacher_id', teacherId)
      .maybeSingle();
    return data;
  },
  async toggle(lessonId: string, teacherId: string, completed: boolean) {
    const { error } = await supabase.from('lesson_progress').upsert({
      lesson_id: lessonId,
      teacher_id: teacherId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'lesson_id,teacher_id' });
    if (error) throw error;
  },
};

export const featured = {
  async getCurrent(today: Date = new Date()): Promise<FeaturedLesson | null> {
    const iso = today.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('featured_lessons')
      .select('*')
      .lte('start_date', iso)
      .gte('end_date', iso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as FeaturedLesson | null;
  },

  async set(payload: {
    lessonId: string;
    startDate: string;
    endDate: string;
    theme?: string;
    createdBy?: string;
  }): Promise<FeaturedLesson> {
    const { data, error } = await supabase
      .from('featured_lessons')
      .insert({
        lesson_id: payload.lessonId,
        start_date: payload.startDate,
        end_date: payload.endDate,
        theme: payload.theme,
        created_by: payload.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    await applyDefaultTemplate(payload.lessonId);
    return data as FeaturedLesson;
  },

  async getActivityForWeek(lessonId: string, weekNumber: number): Promise<LessonActivity | null> {
    const { data, error } = await supabase
      .from('lesson_activities')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('week_number', weekNumber)
      .maybeSingle();
    if (error) throw error;
    return data as LessonActivity | null;
  },
};

async function applyDefaultTemplate(lessonId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('lesson_activities')
    .select('week_number')
    .eq('lesson_id', lessonId)
    .not('week_number', 'is', null);
  const existingWeeks = new Set((existing || []).map((r: any) => r.week_number));

  const toInsert = [];
  for (let w = 1; w <= 5; w++) {
    if (existingWeeks.has(w)) continue;
    toInsert.push({
      lesson_id: lessonId,
      title: `Week ${w}: ${getDefaultActivityType(w)}`,
      supplies: [],
      instructions: '',
      duration_minutes: 30,
      week_number: w,
      activity_type: getDefaultActivityType(w),
    });
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from('lesson_activities').insert(toInsert);
    if (error) throw error;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/services/lessons.service.ts
git commit -m "feat: lessons + featured + progress service"
```

---

## Task 9: Copy + Port ActivityCard Component

**Files:**
- Create: `kingdom-kids/components/faith-pathway/ActivityCard.tsx`

- [ ] **Step 1: Copy from faith-pathway**

Copy `kk-faith-pathway/components/ActivityCard.tsx` → `kingdom-kids/components/faith-pathway/ActivityCard.tsx`.

- [ ] **Step 2: Update imports**

In copied file, replace:
- Relative type imports → `import type { LessonActivity } from '../../types';`
- Remove any imports pointing to faith-pathway-only modules

- [ ] **Step 3: Add week badge**

Find the card's title area in the component. Add above title:
```tsx
{activity.week_number && (
  <span className="text-[10px] font-black uppercase tracking-widest bg-[#EF4E92] text-white px-2 py-0.5 rounded-full">
    Week {activity.week_number} · {activity.activity_type || ''}
  </span>
)}
```

- [ ] **Step 4: Build check**

```bash
cd kingdom-kids && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add kingdom-kids/components/faith-pathway/ActivityCard.tsx
git commit -m "feat: port ActivityCard with week badge"
```

---

## Task 10: Copy LessonTextTab + VideoEmbed

**Files:**
- Create: `kingdom-kids/components/faith-pathway/LessonTextTab.tsx`
- Create: `kingdom-kids/components/faith-pathway/VideoEmbed.tsx`

- [ ] **Step 1: Copy LessonTextTab**

Copy `kk-faith-pathway/components/LessonTextTab.tsx` → `kingdom-kids/components/faith-pathway/LessonTextTab.tsx`. Update relative imports to point to `../../types` and `../../utils/lessonMarkdown`.

- [ ] **Step 2: Copy VideoEmbed**

Same for `VideoEmbed.tsx`.

- [ ] **Step 3: Build check**

```bash
cd kingdom-kids && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/components/faith-pathway/LessonTextTab.tsx kingdom-kids/components/faith-pathway/VideoEmbed.tsx
git commit -m "feat: port LessonTextTab and VideoEmbed"
```

---

## Task 11: FaithPathwayTeacherPage — Ported + Router-Aware

**Files:**
- Create: `kingdom-kids/pages/FaithPathwayTeacherPage.tsx`

- [ ] **Step 1: Copy base**

Copy contents of `kk-faith-pathway/views/TeacherDashboard.tsx` → `kingdom-kids/pages/FaithPathwayTeacherPage.tsx`.

- [ ] **Step 2: Remove logout + Profile dependency**

In copied file:
- Remove `onLogout` prop and all logout button JSX (user logs out via existing kingdom-kids auth)
- Remove `user: Profile` prop
- Change component signature to `const FaithPathwayTeacherPage: React.FC = () => {`

- [ ] **Step 3: Replace service imports**

Replace:
```typescript
import { db } from '../services/supabaseService.ts';
import { Lesson, UserRole, ... } from '../types.ts';
```

With:
```typescript
import { lessons as lessonsApi } from '../services/lessons.service';
import { Lesson, LessonStatus, LessonContentStructure, LessonVideo, Attachment } from '../types';
import { parseMarkdownToStructure } from '../utils/lessonMarkdown';
import { useNavigate } from 'react-router-dom';
```

Replace `db.lessons.list(UserRole.TEACHER)` → `lessonsApi.list('TEACHER')`.
Replace `db.lessons.get(id)` → `lessonsApi.get(id)`.
Replace `parseMarkdownToStructure` inline fn → imported.

- [ ] **Step 4: Replace hash nav with React Router**

Find any `window.location.hash = '#/...'` calls:
Replace with `const navigate = useNavigate();` hook and `navigate('/faith-pathway/lesson/' + id)`.

If dashboard has internal view-switching (selectedLesson state), keep that — just ensure it doesn't rely on hash routing.

- [ ] **Step 5: Rename default export**

```typescript
export default FaithPathwayTeacherPage;
```

- [ ] **Step 6: Build check**

```bash
cd kingdom-kids && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add kingdom-kids/pages/FaithPathwayTeacherPage.tsx
git commit -m "feat: port TeacherDashboard as FaithPathwayTeacherPage"
```

---

## Task 12: FaithPathwayAdminPage + FaithPathwayLessonPage

**Files:**
- Create: `kingdom-kids/pages/FaithPathwayAdminPage.tsx`
- Create: `kingdom-kids/pages/FaithPathwayLessonPage.tsx`

- [ ] **Step 1: Copy AdminDashboard → FaithPathwayAdminPage**

Copy `kk-faith-pathway/views/AdminDashboard.tsx` → `kingdom-kids/pages/FaithPathwayAdminPage.tsx`.

Apply same transformations as Task 11:
- Remove `onLogout`, `user: Profile` props
- Replace service imports with `lessons.service` + `featured`
- Replace hash nav with `useNavigate()`
- Rename export to `FaithPathwayAdminPage`

- [ ] **Step 2: Copy LessonDetail → FaithPathwayLessonPage**

Copy `kk-faith-pathway/views/LessonDetail.tsx` → `kingdom-kids/pages/FaithPathwayLessonPage.tsx`.

Apply:
- Remove auth props
- Replace imports
- Use `useParams()` to read `:id`:
```typescript
import { useParams, useNavigate } from 'react-router-dom';
const { id } = useParams<{ id: string }>();
```

- [ ] **Step 3: Build check**

```bash
cd kingdom-kids && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/pages/FaithPathwayAdminPage.tsx kingdom-kids/pages/FaithPathwayLessonPage.tsx
git commit -m "feat: port AdminDashboard and LessonDetail to kingdom-kids"
```

---

## Task 13: FeaturedLessonManager (Admin UI)

**Files:**
- Create: `kingdom-kids/components/faith-pathway/FeaturedLessonManager.tsx`

- [ ] **Step 1: Create component**

Create `kingdom-kids/components/faith-pathway/FeaturedLessonManager.tsx`:
```typescript
import React, { useEffect, useState } from 'react';
import { featured, lessons as lessonsApi } from '../../services/lessons.service';
import type { Lesson, FeaturedLesson } from '../../types';

const FeaturedLessonManager: React.FC = () => {
  const [current, setCurrent] = useState<FeaturedLesson | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [form, setForm] = useState({ lessonId: '', startDate: '', endDate: '', theme: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [cur, ls] = await Promise.all([featured.getCurrent(), lessonsApi.list('ADMIN')]);
    setCurrent(cur);
    setAllLessons(ls);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lessonId || !form.startDate || !form.endDate) return;
    setSaving(true);
    try {
      await featured.set({
        lessonId: form.lessonId,
        startDate: form.startDate,
        endDate: form.endDate,
        theme: form.theme,
        createdBy: 'ADMIN',
      });
      setMsg('Featured lesson pinned — default weekly activities applied');
      await load();
    } catch (e: any) {
      setMsg('Failed: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <h2 className="text-xl font-bold mb-4">Featured Lesson</h2>

      {current ? (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200 text-sm">
          <div><strong>Currently featured:</strong> {allLessons.find(l => l.id === current.lesson_id)?.title || current.lesson_id}</div>
          <div className="text-xs text-slate-600 mt-1">
            {current.start_date} → {current.end_date} {current.theme && `· Theme: ${current.theme}`}
          </div>
        </div>
      ) : (
        <p className="text-slate-500 mb-4 text-sm">No lesson pinned for today</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold mb-1">Lesson</label>
          <select
            value={form.lessonId}
            onChange={e => setForm(f => ({ ...f, lessonId: e.target.value }))}
            className="w-full border rounded p-2 text-sm"
            required
          >
            <option value="">-- Select lesson --</option>
            {allLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1">Start (first Sunday)</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full border rounded p-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">End (last Sunday)</label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full border rounded p-2 text-sm"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Theme</label>
          <input
            type="text"
            value={form.theme}
            onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
            className="w-full border rounded p-2 text-sm"
            placeholder="e.g. April: God's Love"
          />
        </div>
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {saving ? 'Pinning...' : 'Pin Featured Lesson'}
        </button>
        {msg && <p className="text-xs mt-2 text-slate-600">{msg}</p>}
      </form>
    </div>
  );
};

export default FeaturedLessonManager;
```

- [ ] **Step 2: Wire into admin page**

In `kingdom-kids/pages/FaithPathwayAdminPage.tsx`, add at top of main content:
```tsx
import FeaturedLessonManager from '../components/faith-pathway/FeaturedLessonManager';
// ...
<div className="mb-6">
  <FeaturedLessonManager />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add kingdom-kids/components/faith-pathway/FeaturedLessonManager.tsx kingdom-kids/pages/FaithPathwayAdminPage.tsx
git commit -m "feat: FeaturedLessonManager + wire into admin page"
```

---

## Task 14: FeaturedLessonCard (Dashboard Widget)

**Files:**
- Create: `kingdom-kids/components/faith-pathway/FeaturedLessonCard.tsx`

- [ ] **Step 1: Create card**

Create `kingdom-kids/components/faith-pathway/FeaturedLessonCard.tsx`:
```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { featured, lessons as lessonsApi } from '../../services/lessons.service';
import { computeCurrentWeekNumber, getDefaultActivityType } from '../../utils/featuredWeek';
import type { Lesson, LessonActivity, FeaturedLesson } from '../../types';

const FeaturedLessonCard: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<{ feat: FeaturedLesson; lesson: Lesson; activity: LessonActivity | null; week: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const feat = await featured.getCurrent();
        if (!feat) { setLoading(false); return; }
        const lesson = await lessonsApi.get(feat.lesson_id);
        const week = computeCurrentWeekNumber(feat.start_date, new Date());
        const activity = await featured.getActivityForWeek(feat.lesson_id, week);
        setState({ feat, lesson, activity, week });
      } catch (e) {
        console.error('Failed to load featured', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;
  if (!state) return null;

  const { feat, lesson, activity, week } = state;
  const activityType = activity?.activity_type || getDefaultActivityType(week);

  return (
    <div
      onClick={() => navigate(`/faith-pathway/lesson/${lesson.id}`)}
      className="bg-gradient-to-br from-[#EF4E92] to-[#003882] text-white rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl transition"
    >
      <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
        This Week's Lesson · Week {week} of 4
      </div>
      <h3 className="text-2xl font-black mt-2">{lesson.title}</h3>
      {feat.theme && <p className="text-sm opacity-90 mt-1">Theme: {feat.theme}</p>}

      <div className="mt-4 bg-white/20 backdrop-blur rounded-xl p-3">
        <div className="text-[9px] font-black uppercase tracking-widest opacity-80">📌 This Week's Activity</div>
        <div className="font-bold mt-1">{activityType}</div>
        {activity?.title && <div className="text-xs opacity-90 mt-1">{activity.title}</div>}
      </div>

      <div className="text-xs mt-3 opacity-80">→ Tap to open lesson</div>
    </div>
  );
};

export default FeaturedLessonCard;
```

- [ ] **Step 2: Commit**

```bash
git add kingdom-kids/components/faith-pathway/FeaturedLessonCard.tsx
git commit -m "feat: FeaturedLessonCard dashboard widget"
```

---

## Task 15: Embed FeaturedLessonCard in Home Dashboard

**Files:**
- Modify: kingdom-kids home dashboard page (find it via grep)

- [ ] **Step 1: Locate home dashboard**

Run:
```bash
grep -rn "Dashboard\|HomePage" kingdom-kids/pages/ --include="*.tsx" -l
```

Identify the page rendered at `/` for TEACHER role.

- [ ] **Step 2: Add FeaturedLessonCard at top**

In the identified dashboard file, import:
```typescript
import FeaturedLessonCard from '../components/faith-pathway/FeaturedLessonCard';
```

Add at top of render (before existing content, gated to TEACHER/ADMIN):
```tsx
{(session?.role === 'TEACHER' || session?.role === 'ADMIN') && (
  <div className="mb-6">
    <FeaturedLessonCard />
  </div>
)}
```

(Use whatever session/auth variable already exists in the file.)

- [ ] **Step 3: Build check**

```bash
cd kingdom-kids && npm run build
```

Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add <dashboard file path>
git commit -m "feat: embed FeaturedLessonCard on home dashboard"
```

---

## Task 16: Wire Routes in App.tsx

**Files:**
- Modify: `kingdom-kids/App.tsx`

- [ ] **Step 1: Add imports**

In `kingdom-kids/App.tsx`:
```typescript
import FaithPathwayTeacherPage from './pages/FaithPathwayTeacherPage';
import FaithPathwayAdminPage from './pages/FaithPathwayAdminPage';
import FaithPathwayLessonPage from './pages/FaithPathwayLessonPage';
```

- [ ] **Step 2: Add routes**

Inside Routes block:
```tsx
<Route
  path="/faith-pathway"
  element={session ? <FaithPathwayTeacherPage /> : <Navigate to="/login" />}
/>
<Route
  path="/faith-pathway/lesson/:id"
  element={session ? <FaithPathwayLessonPage /> : <Navigate to="/login" />}
/>
<Route
  path="/faith-pathway/admin"
  element={session?.role === 'ADMIN' ? <FaithPathwayAdminPage /> : <Navigate to="/" />}
/>
```

(Match the exact auth-gating pattern used by other routes in this file.)

- [ ] **Step 3: Add nav link**

In main nav (same file or referenced nav component), add:
```tsx
<Link to="/faith-pathway" className="...">Faith Pathway</Link>
```

- [ ] **Step 4: Build check**

```bash
cd kingdom-kids && npm run build
```

Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add kingdom-kids/App.tsx
git commit -m "feat: /faith-pathway/* routes wired"
```

---

## Task 17: Offline Cache Namespacing

**Files:**
- Modify: `kingdom-kids/services/lessons.service.ts`

- [ ] **Step 1: Find existing offline cache util**

Run:
```bash
grep -n "kk_cache_\|offlineCache" kingdom-kids/utils/*.ts kingdom-kids/services/*.ts
```

Locate the caching wrapper used by existing services.

- [ ] **Step 2: Wrap lessons calls with offline cache using `kk_fp_` prefix**

In `kingdom-kids/services/lessons.service.ts`, wrap list/get in the existing cache pattern:
```typescript
// Example (adapt to actual util API):
import { withOfflineCache } from '../utils/offlineCache';

// inside lessons.list:
return withOfflineCache('kk_fp_cache_lessons_' + role, async () => {
  // ...existing code
});
```

If kingdom-kids `offlineCache` doesn't exist with compatible API, copy faith-pathway's minimal version to `kingdom-kids/utils/offlineCache.ts` (only if absent). Use distinct key prefix `kk_fp_`.

- [ ] **Step 3: Build check**

```bash
cd kingdom-kids && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add kingdom-kids/services/lessons.service.ts kingdom-kids/utils/offlineCache.ts
git commit -m "feat: offline cache for lessons with kk_fp_ prefix"
```

---

## Task 18: Gemini Lesson Service

**Files:**
- Create: `kingdom-kids/services/gemini-lesson.service.ts`

- [ ] **Step 1: Copy from faith-pathway**

Copy `kk-faith-pathway/services/geminiService.ts` → `kingdom-kids/services/gemini-lesson.service.ts`.

- [ ] **Step 2: Update imports**

Relative imports → point to kingdom-kids types. Keep exports: `generateFullLesson`, `categorizeLessonTitle`, `generateLessonSummary`.

- [ ] **Step 3: Env var**

If it reads `VITE_GEMINI_API_KEY`, verify kingdom-kids `.env.local` has same var (or add note to README).

- [ ] **Step 4: Update FaithPathwayAdminPage imports**

In admin page, replace old gemini imports with:
```typescript
import { generateFullLesson, categorizeLessonTitle, generateLessonSummary } from '../services/gemini-lesson.service';
```

- [ ] **Step 5: Build check**

```bash
cd kingdom-kids && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add kingdom-kids/services/gemini-lesson.service.ts kingdom-kids/pages/FaithPathwayAdminPage.tsx
git commit -m "feat: port Gemini lesson service"
```

---

## Task 19: Manual E2E Test

**Files:** none

- [ ] **Step 1: Verify migration + import ran**

Query kingdom-kids Supabase:
```sql
SELECT COUNT(*) FROM lessons;
SELECT COUNT(*) FROM lesson_activities;
SELECT COUNT(*) FROM featured_lessons;
```

Counts match export.

- [ ] **Step 2: Login as TEACHER — verify home dashboard**

- No featured_lessons yet → card hidden
- Login as ADMIN → `/faith-pathway/admin` → pin a lesson via FeaturedLessonManager
- Go back to home dashboard as TEACHER → FeaturedLessonCard appears with current week

- [ ] **Step 3: Verify week template applied**

In Supabase:
```sql
SELECT week_number, activity_type FROM lesson_activities
WHERE lesson_id = '<featured_lesson_id>' AND week_number IS NOT NULL
ORDER BY week_number;
```

Expected: 5 rows (week 1-5) with correct activity_type template values.

- [ ] **Step 4: Teacher opens lesson from card**

Click card → lands on `/faith-pathway/lesson/:id` → sees READ/TEACH/ENGAGE + media + activities.

- [ ] **Step 5: Verify current-week calc**

Pin a lesson with start_date = 2 weeks ago. FeaturedLessonCard should show "Week 3" (if 2 full weeks passed + today in 3rd).

- [ ] **Step 6: 5-Sunday month test**

Manually pin a lesson covering March 2026 (5 Sundays). Mock today's date to last Sunday of month → week 5 → "Scripture Quest" activity type appears.

- [ ] **Step 7: Admin override activity type for week 2**

In admin UI, edit week 2 activity_type to "Custom Memory Verse: John 3:16". Reload teacher dashboard during week 2 → override shows.

- [ ] **Step 8: Offline mode**

Disable network → reload `/faith-pathway` → cached lessons display from `kk_fp_cache_lessons_*`.

- [ ] **Step 9: Verify old faith-pathway DB untouched**

Query old instance — rows unchanged (read-only fallback remains).

- [ ] **Step 10: Commit E2E notes**

```bash
git commit --allow-empty -m "test: manual E2E smoke pass for faith-pathway migration"
```

---

## Task 20: Sunset Old App

**Files:** (deployment)

**Warning:** This task deletes the standalone faith-pathway deployment. Do NOT run until Task 19 passes and 1 week of prod monitoring confirms merged app is stable.

- [ ] **Step 1: Wait 1 week after merged deployment**

Verify no bug reports, traffic migrated to `/faith-pathway/*`.

- [ ] **Step 2: Archive old Supabase DB**

In old faith-pathway Supabase project: pause project (keeps data, stops billing). Do not delete for 30 days.

- [ ] **Step 3: Remove old app from Vercel**

Sunset `kk-faith-pathway` Vercel deployment.

- [ ] **Step 4: Archive source repo**

Mark `kk-faith-pathway` as archived in git hosting.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: sunset kk-faith-pathway standalone"
```

---

## Self-Review Results

- [x] **Spec coverage:**
  - Section 1-2 (route structure) → Task 16
  - Section 3 (data migration) → Tasks 3-4
  - Section 4 (schema) → Tasks 1-2
  - Section 5 (weekly template) → Tasks 6, 8 (applyDefaultTemplate)
  - Section 6 (dashboard integration) → Tasks 14-15
  - Section 7 (code merge) → Tasks 9-13, 18
  - Section 8 (new service fns) → Task 8
  - Section 9 (risks/mitigations) → covered in scripts + Task 17 (cache namespace)
  - Section 10 (testing) → Tasks 6 (unit), 19 (E2E)
  - Section 11 (rollout) → Tasks 19-20

- [x] **Placeholder scan:** All code complete; Task 15/17 have "find via grep" steps since exact filename depends on codebase — these are concrete lookup commands, not placeholders.

- [x] **Type consistency:** `Lesson`, `LessonActivity`, `FeaturedLesson`, `LessonStatus` used consistently. Service namespaces `lessons`, `featured`, `progress` match throughout.

---

## Execution Handoff

All 3 plans written. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints

Which approach for executing these 3 plans (A → B → C in order)?
