# Faith Pathway Migration — Design Spec
**Date:** 2026-04-24
**Scope:** Merge standalone `kk-faith-pathway` app into `kingdom-kids`. Unify auth, DB, deployment. Add featured lesson + weekly activity templates to help non-techy teachers.

---

## 1. Problem Statement

Two separate apps today:
- `kingdom-kids` — attendance, points, QR scan, student management (main app)
- `kk-faith-pathway` — Bible lesson portal (teachers + admins)

Issues:
- Teachers ask "what's today's lesson?" frequently — no visibility on home dashboard
- Separate Supabase instances (double maintenance)
- Separate login systems (user friction)
- Faith-pathway uses hash routing (inconsistent with kingdom-kids React Router)

Goal: single app, one login, featured lesson visible on dashboard, weekly activity templates.

---

## 2. Route Structure (nested under kingdom-kids)

```
/faith-pathway              → teacher dashboard (carousel of lessons)
/faith-pathway/lesson/:id   → lesson detail (READ/TEACH/ENGAGE + media + activities)
/faith-pathway/admin        → admin CRUD + AI lesson generation (ADMIN role only)
```

All routes gated by existing kingdom-kids auth (`ADMIN`, `TEACHER` roles). Faith-pathway's Login.tsx is deleted.

---

## 3. Data Migration

**From:** faith-pathway Supabase (`wfjhmimqntryohnrmuxc`)
**To:** kingdom-kids Supabase (`ewlvfgfvxauxqfruyfoz`)

**Tables migrated:**
- `lessons` (title, summary, content, category, grade range, status)
- `lesson_videos`
- `lesson_activities`
- `attachments`
- `lesson_progress`

**Process:**
1. Export each table to JSON via Supabase SQL editor / pg_dump
2. Verify row counts locally
3. Import into kingdom-kids Supabase preserving UUIDs (no collision risk)
4. Keep old faith-pathway DB read-only for 30 days as rollback

**Attachments:** stored as Google Drive URLs — portable, no Supabase Storage migration needed.

---

## 4. Schema Changes

```sql
-- Weekly activity variants
ALTER TABLE lesson_activities ADD COLUMN week_number   INT     DEFAULT NULL;  -- 1-5
ALTER TABLE lesson_activities ADD COLUMN activity_type VARCHAR DEFAULT NULL;

-- Featured lesson (pinned per month)
CREATE TABLE featured_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  start_date DATE NOT NULL,    -- first Sunday of month
  end_date DATE NOT NULL,      -- last Sunday of month
  theme TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_featured_lessons_date_range ON featured_lessons(start_date, end_date);
```

---

## 5. Weekly Activity Template

Fixed default template applied when admin pins a featured lesson (admin can override per month — flexible):

| Week | Activity Type |
|------|--------------|
| 1 | Bible Stories |
| 2 | Memory Verse |
| 3 | GAMES & QUIZ |
| 4 | Arts / Made by Tiny Hands |
| 5 *(only if month has 5 Sundays)* | Scripture Quest: A Fun Bible Quiz & Memory Verse Day |

**Week 5 logic:** count Sundays in current month — if 5 exist, show week 5 activity.

**Current week calculation:**
```
weekNumber = floor((today - featured.start_date) / 7) + 1
// clamped 1-5
```

---

## 6. Home Dashboard Integration

Kingdom-kids home dashboard (teacher view) shows new card at top:

```
┌─ THIS WEEK'S LESSON (Week 2 of 4) ───────────┐
│  [Featured lesson thumbnail]                  │
│  Title: [Featured lesson title]               │
│  Theme: [April theme]                         │
│                                               │
│  📌 This Week's Activity:                     │
│  Type: Memory Verse                           │
│  [Activity title + supplies list]             │
│                                               │
│  → Tap to open lesson                         │
└───────────────────────────────────────────────┘
```

Visible to `TEACHER` and `ADMIN` roles only. Admin sees same card + "Edit" button.

---

## 7. Code Merge Plan

**Copy from `kk-faith-pathway/` → `kingdom-kids/`:**

| Source | Destination | Notes |
|--------|-------------|-------|
| `views/TeacherDashboard.tsx` | `pages/FaithPathwayTeacherPage.tsx` | Remove logout button, use existing auth |
| `views/AdminDashboard.tsx` | `pages/FaithPathwayAdminPage.tsx` | Add featured-lesson management UI |
| `views/LessonDetail.tsx` | `pages/FaithPathwayLessonPage.tsx` | Rename references |
| `views/Login.tsx` | **DELETE** | Use kingdom-kids auth |
| `components/ActivityCard.tsx` | `components/faith-pathway/ActivityCard.tsx` | Extend to show week_number badge |
| `components/LessonTextTab.tsx` | `components/faith-pathway/LessonTextTab.tsx` | As-is |
| `components/VideoEmbed.tsx` | `components/faith-pathway/VideoEmbed.tsx` | As-is |
| `services/supabaseService.ts` | Merge into `services/db.service.ts` | Add `lessons`, `featured` namespaces |
| `services/geminiService.ts` | `services/gemini-lesson.service.ts` | Keep separate from kingdom-kids gemini.service.ts |

**Routing conversion:**
- Replace `window.location.hash = '#/...'` → `useNavigate()` hook
- Replace hash route matcher → `<Route path="/faith-pathway/*">` in App.tsx

**Offline cache namespacing:**
- Prefix keys: `kk_fp_cache_lessons`, `kk_fp_cache_progress` (avoid collision with existing `kk_cache_*`)

---

## 8. New Service Functions

```typescript
// db.service.ts additions
featured: {
  getCurrent(): Promise<FeaturedLesson | null>,
  // Returns featured lesson where today between start_date and end_date
  
  set(lessonId, startDate, endDate, theme): Promise<FeaturedLesson>,
  // Creates featured_lessons row, applies template to lesson_activities
  
  getCurrentWeek(): number,
  // Computes current week number (1-5) based on today and start_date
  
  getActivityForWeek(lessonId, weekNumber): Promise<LessonActivity | null>
}
```

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Data loss during migration | Export to JSON, verify count, keep old DB read-only 30 days |
| Route collision | `/faith-pathway/*` prefix isolates cleanly |
| Role mismatch | Both apps use ADMIN/TEACHER — direct map |
| Attachment URLs break | Google Drive URLs — portable |
| Offline cache conflicts | Namespace keys with `kk_fp_` prefix |
| Hash routing rewrites | Mechanical — `navigate()` replaces `window.location.hash` |

---

## 10. Testing

**Unit:**
- Week number calculation (4-Sunday month, 5-Sunday month, first day, last day)
- Featured lesson date-range lookup (today = last Sunday)
- Template application on new featured lesson

**Migration:**
- Dry-run export → verify row counts
- Import → verify UUIDs preserved, foreign keys intact

**Manual E2E:**
- Teacher login → dashboard shows featured card → tap → opens correct lesson
- Admin pins new lesson → 4-5 weekly activities auto-created with default types
- Admin overrides week 2 activity type → teacher sees override on correct Sunday
- 5-Sunday month → Scripture Quest appears on week 5
- Offline mode → cached lesson loads, mutations queued

---

## 11. Rollout Order

1. Migrate data to kingdom-kids Supabase (off-hours)
2. Deploy merged kingdom-kids with `/faith-pathway/*` routes active (old app still live as fallback)
3. Monitor prod for 1 week — verify traffic + no errors
4. Sunset `kk-faith-pathway` deployment
5. Archive old Supabase DB after 30 days

---

## 12. Open Considerations

- Design system reconciliation: faith-pathway uses pink (#EF4E92) + navy (#003882). Kingdom-kids may differ — keep faith-pathway styling within `/faith-pathway/*` routes for now, unify later if needed.
- Gemini service: two separate services (lesson vs general) — consolidate later if overlap grows.
- Lesson progress per teacher: already works via `lesson_progress` table, maps to kingdom-kids `UserSession.username`.
