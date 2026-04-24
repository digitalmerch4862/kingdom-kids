# ID Issuance Monitoring — Design Spec
**Date:** 2026-04-24
**Scope:** Track physical ID card printing per student, monitor qualification, handle lost/reprint lifecycle
**Page route:** `/admin/id-issuance` (ADMIN role only)

---

## 1. Problem Statement

Admin prints physical ID cards with QR codes for students. Currently no visibility into:
- Who already has an ID
- Who is qualified to receive one (new students need 4 consecutive Sunday attendances)
- Who lost their ID and needs a reprint

Goal: Single dashboard + scan-to-tag workflow so admin can process IDs efficiently every Sunday.

---

## 2. Architecture & Data Flow

```
/admin/id-issuance   (ADMIN only)

On load:
  → fetch all active students
  → fetch attendance_sessions per student
  → compute consecutive-Sunday streak per student (last 4 Sundays)
  → group students into 4 buckets:
      Has ID (active)  → id_issued_at NOT NULL AND id_needs_reprint = false
      Needs Reprint    → id_needs_reprint = true
      Qualified        → id_issued_at IS NULL AND streak >= 4
      Not Yet          → id_issued_at IS NULL AND streak < 4

QR Scanner (embedded, always visible):
  → scan student accessKey from QR
  → lookup student → branch based on bucket:
      Qualified     → confirm dialog → SET id_issued_at = NOW() → move to Has ID
      Has ID        → yellow toast "Already issued [date] — mark as lost?" button
      Not Yet       → red toast "Only X/4 consecutive — not eligible yet"
      Needs Reprint → confirm dialog → SET id_needs_reprint=false, id_issued_at=NOW()
      Invalid QR    → red toast "Unknown QR code"
```

**Real-time updates** — scan tags student, UI moves card between buckets instantly (no page reload).

---

## 3. Data Model (DB changes)

```sql
ALTER TABLE students ADD COLUMN id_issued_at      TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE students ADD COLUMN id_needs_reprint  BOOLEAN     DEFAULT FALSE;
ALTER TABLE students ADD COLUMN id_reprint_count  INT         DEFAULT 0;
ALTER TABLE students ADD COLUMN id_last_lost_at   TIMESTAMPTZ DEFAULT NULL;
```

**Field meanings:**
- `id_issued_at` — when current physical card was issued (refreshed on reprint)
- `id_needs_reprint` — true when lost reported, awaiting new card delivery
- `id_reprint_count` — lifetime count of reprints (monitoring repeat losers)
- `id_last_lost_at` — timestamp of last loss report

**accessKey (QR value) stays the same across reprints** — same QR code, new physical card only.

---

## 4. Qualification Logic — 4 Consecutive Sundays

```
Inputs:
  today = current date
  studentId

Steps:
  1. Compute last 4 Sunday dates walking backwards from today
     (e.g., if today is Wed Apr 22 2026 → [Apr 19, Apr 12, Apr 5, Mar 29])
  2. Query attendance_sessions for studentId on those 4 dates
  3. If ALL 4 present → streak = 4 → qualified
  4. If gap found → count consecutive from most recent → streak = N (< 4)

Display on student card:
  Streak: 3/4 (progress toward qualification)
```

Shown on "Not Yet" cards so admin sees who is close.

---

## 5. Lost ID Flow

```
Student reports lost card
  ↓ Admin taps "Mark Lost" on student card
  → id_needs_reprint = true
  → id_last_lost_at = NOW()
  → id_reprint_count += 1
  → audit_log: ID_MARKED_LOST
  → student moves to "Needs Reprint" bucket

Admin prints new card (same accessKey/QR)

Admin scans new card QR to confirm delivery
  → id_needs_reprint = false
  → id_issued_at = NOW()  (refresh timestamp)
  → audit_log: ID_REPRINTED
  → student moves back to "Has ID" bucket
```

**Lost history visible on card:** `Lost 2x | Last: Jan 12 2026`

---

## 6. Components

```
IdIssuancePage.tsx
├── SummaryBar        — 4 counters: Has ID (green) | Needs Reprint (orange) | Qualified (yellow) | Not Yet (gray)
├── TabGroup          — switch between 4 buckets
│     Qualified       → sorted by lastAttendedDate DESC (recent attenders first)
│     Has ID          → sorted by id_issued_at DESC
│     Needs Reprint   → sorted by id_last_lost_at DESC
│     Not Yet         → sorted by streak DESC (closest to 4 first)
├── StudentCard       — name | ageGroup | streak or id_issued_at | "Mark Lost" button (if Has ID)
├── QRScanner         — embedded, always visible (reuse from existing QRScanPage)
│     └─ ScanResult   — toast overlay per scan outcome
└── ConfirmDialog     — "Issue ID to [Name]?" / "Confirm reprint for [Name]?"
```

**New service functions (`db.service.ts`):**
- `getStudentsWithAttendanceStreak()` — returns students + consecutive-Sunday streak count
- `setIdIssued(studentId)` — sets id_issued_at = NOW(), clears needs_reprint
- `markIdLost(studentId)` — sets needs_reprint=true, increments reprint_count, sets last_lost_at

---

## 7. Error Handling

| Scan Result | UI Response |
|-------------|-------------|
| Valid, Qualified | Green toast + confirm dialog → tag |
| Valid, Has ID | Yellow toast "Already issued [date]" + "Mark Lost" button |
| Valid, Not Yet | Red toast "Only X/4 consecutive — not eligible" |
| Valid, Needs Reprint | Green toast + confirm dialog → complete reprint |
| Invalid QR | Red toast "Unknown QR code" |
| Network error mid-tag | Retry button, optimistic UI reverts on failure |

**Audit trail via existing `audit_log` table:**
- `ID_ISSUED` — first-time issuance
- `ID_MARKED_LOST` — lost reported
- `ID_REPRINTED` — replacement confirmed

All log entries include `actor`, `studentId`, timestamp.

---

## 8. Testing

- **Unit:** Consecutive Sunday streak logic — mock attendance dates, verify streak calculation across gaps
- **Unit:** Bucket categorization — given student state, verify correct bucket
- **Manual E2E:** 
  - Qualify new student: attend 4 Sundays → scan → tagged
  - Lost flow: tag → mark lost → reprint → scan → active again
  - Edge: scan unqualified student → correct toast
  - Edge: scan unknown QR → correct toast

---

## 9. Open Considerations

- Streak calculation runs on every page load — may be slow for large student counts. If >500 students, cache streak per student in DB with nightly refresh.
- "Mark Lost" requires confirm dialog to prevent accidental clicks.
- Reprint count threshold (e.g., `>= 3`) could trigger a warning badge for chronic losers — future enhancement.
