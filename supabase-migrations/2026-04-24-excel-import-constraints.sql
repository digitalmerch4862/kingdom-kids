-- Run in Supabase SQL Editor BEFORE first Excel import.
-- Required so upsert onConflict works correctly.

ALTER TABLE attendance_sessions
  ADD CONSTRAINT IF NOT EXISTS uq_attendance_student_date
  UNIQUE ("studentId", "sessionDate");

ALTER TABLE point_ledger
  ADD CONSTRAINT IF NOT EXISTS uq_point_student_date_cat
  UNIQUE ("studentId", "entryDate", category);
