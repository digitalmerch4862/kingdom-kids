# Excel Import — Design Spec
**Date:** 2026-04-24  
**Scope:** Import yearly Kingdom Kids Excel attendance/points data into Supabase  
**Direction:** Excel → App (one-way)  
**Conflict resolution:** Excel wins (overwrite existing records)

---

## 1. Architecture & Data Flow

New admin-only page `ExcelImportPage.tsx` at route `/admin/import`.

```
Excel Upload (.xlsx)
  ↓ SheetJS (xlsx) — parse in browser, no server needed
Parse both sheets → normalize to:
  { name, ageGroup, dates: { "2026-01-11": { attended: bool, points: number } } }
  ↓
Fetch all students from Supabase
  ↓
Name Matching Engine:
  1. Exact match → auto-resolved → use existing studentId + accessKey (QR already works)
  2. Fuzzy match (Levenshtein <3 edits) → suggest + confirm → same, reuse existing record
  3. No match → user picks from dropdown OR "Create New Student"
       └─ Create New: auto-generate accessKey (YYYY### format, e.g. 2026001)
          so student is immediately QR-scannable after import
  ↓
Diff Preview Table — per-student summary of what will be written
  ↓
Confirm → batch upsert (50/batch):
  - students (insert new with generated accessKey if "Create New" chosen — FIRST)
  - attendance_sessions (overwrite per student+date, linked to resolved studentId)
  - point_ledger (overwrite per student+date+category="EXCEL_IMPORT", linked to resolved studentId)
```

**New dependency:** `xlsx` (SheetJS) — browser-side Excel parsing. No backend changes.

---

## 2. Components

```
ExcelImportPage.tsx
├── Step 1: FileUpload        — drag-drop zone, .xlsx only
├── Step 2: NameMatcher       — table of unresolved names
│     each row: Excel name | fuzzy suggestion | dropdown (all students) | "Create New" toggle
├── Step 3: DiffPreview       — paginated table
│     columns: Student | Dates affected | Attendance changes | Points changes | New student?
└── Step 4: ImportProgress    — progress bar + per-student result (✓/✗)

utils/excelParser.ts    — SheetJS parsing, normalize both sheets
utils/nameMatcher.ts    — Levenshtein fuzzy match logic
utils/importBatcher.ts  — chunk upserts (50/batch)
```

**State machine:** `UPLOAD → PARSING → MATCHING → PREVIEW → IMPORTING → DONE`

Route added to `App.tsx`, gated to `ADMIN` role only.

---

## 3. Data Mapping

| Excel Field | Supabase Table | Notes |
|-------------|---------------|-------|
| Name (LastName, First) | `students.fullName` | Matched to existing student (priority) OR new student created |
| (new student) | `students.accessKey` | Auto-generated `YYYY###` (e.g. `2026001`, sequential, no collision) — enables QR scanning immediately |
| (new student) | `students.isEnrolled` | Set `true`, `studentStatus="active"` |
| Age group header row | `students.ageGroup` | "4-6 YRS OLD AND BELOW" → `"3-6"`, etc. |
| Date col + `1` present | `attendance_sessions` | `sessionDate`, `checkInTime="09:00"`, `status="CLOSED"`, `checkedInBy="EXCEL_IMPORT"` |
| Date col + points value | `point_ledger` | `category="EXCEL_IMPORT"`, `points=value`, `recordedBy="EXCEL_IMPORT"` |
| GRADUATE col marked | `students.studentStatus` | Set to `"alumni"` |

**Age group mapping:**
- "4-6 YRS OLD AND BELOW" → `"3-6"`
- "7-9 YRS OLD" → `"7-9"`
- "10-12 YRS OLD" → `"10-12"`

---

## 4. Student Priority & accessKey Generation

**Existing students (matched):**
- Reuse their `studentId` and existing `accessKey` — no changes to student record
- Attendance + points linked to their ID — QR scanning continues working

**New students (unmatched, "Create New"):**
- Query Supabase for highest existing `accessKey` starting with current year (e.g., `2026`)
- Increment: `2026001`, `2026002`, ... — no collision with existing keys
- Insert student first, then link attendance/points to new `studentId`
- Student immediately enrollable in QR/face scan system

---

## 5. Edge Cases

| Case | Handling |
|------|----------|
| Date `12/29` before `12/6` in Excel (typo) | Parser sorts all dates chronologically |
| Section header rows (e.g., "4-6 YRS OLD AND BELOW") | Skipped via name validation (no comma = not a student) |
| `*` marker in column 2 | Ignored |
| Student with 0 attendance | Matched/created, no attendance records inserted |
| Duplicate points same student+date | Single upsert by `studentId+entryDate+category` |
| User skips unresolved name | Skip entirely, listed in "skipped" summary |

---

## 5. Error Handling & Rollback

**Non-fatal (per-student):**
- Failed upsert → log error, continue batch, show red row in results

**Fatal:**
- Excel parse failure → error message, stay on Step 1
- Supabase connection lost mid-import → stop batch, show success count, offer "Resume" (skips already-imported records)

**No full rollback needed** — partial imports leave valid data. Resume handles re-runs safely.

**Audit trail:**
- `checkedInBy="EXCEL_IMPORT"` on all attendance records
- `recordedBy="EXCEL_IMPORT"` on all point records
- Easily reversed via SQL: `DELETE FROM attendance_sessions WHERE checked_in_by = 'EXCEL_IMPORT'`
- Import summary (timestamp, counts, errors) saved to `localStorage`

---

## 6. Testing

- `excelParser.ts` + `nameMatcher.ts` — pure functions, unit tested via Vitest
- Manual E2E with `yearly kingdom kids 2026.xlsx`
- Test file: both sheets, ~129-160 rows, 62-67 columns
