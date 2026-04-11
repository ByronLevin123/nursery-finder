-- 032: Parent Q&A for nursery profiles
-- Questions and answers that parents (and providers) can post on nursery pages.

CREATE TABLE IF NOT EXISTS nursery_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published', -- 'published', 'hidden', 'flagged'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nursery_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES nursery_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_provider BOOLEAN DEFAULT false,
  answer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_urn ON nursery_questions (nursery_urn) WHERE status = 'published';
CREATE INDEX idx_answers_question ON nursery_answers (question_id) WHERE status = 'published';
