-- Extend lesson_activities with week slot + activity type
ALTER TABLE lesson_activities ADD COLUMN IF NOT EXISTS week_number   INT;
ALTER TABLE lesson_activities ADD COLUMN IF NOT EXISTS activity_type TEXT;

-- Featured lesson per week
CREATE TABLE IF NOT EXISTS featured_lessons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,           -- ISO date of the Monday that starts the week
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start)                 -- one featured lesson per week
);

CREATE INDEX IF NOT EXISTS idx_featured_lessons_week_start ON featured_lessons(week_start);
CREATE INDEX IF NOT EXISTS idx_lesson_activities_week ON lesson_activities(week_number);
