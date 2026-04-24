ALTER TABLE students ADD COLUMN IF NOT EXISTS id_issued_at      TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS id_needs_reprint  BOOLEAN     DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS id_reprint_count  INT         DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS id_last_lost_at   TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_students_id_issued_at ON students(id_issued_at);
CREATE INDEX IF NOT EXISTS idx_students_id_needs_reprint ON students(id_needs_reprint) WHERE id_needs_reprint = TRUE;
