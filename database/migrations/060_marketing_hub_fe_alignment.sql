-- 060_marketing_hub_fe_alignment.sql — align Marketing Hub schema with the admin UI
--
-- The admin Marketing Hub (frontend/app/admin/marketing/page.tsx) renders a richer
-- shape than the original 059 tables stored. This migration ADDS the UI-shaped
-- columns (non-destructively — legacy columns are kept and still populated by the
-- API so existing constraints are never violated) and backfills them from the
-- legacy columns. No columns are dropped and no CHECK/NOT NULL constraints change.

-- ---------------------------------------------------------------------------
-- 1. marketing_content — UI sends content_type/topic/platform/tone
-- ---------------------------------------------------------------------------
ALTER TABLE marketing_content
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS topic        TEXT,
  ADD COLUMN IF NOT EXISTS platform     TEXT,
  ADD COLUMN IF NOT EXISTS tone         TEXT;

-- Backfill content_type from the legacy `type` column.
UPDATE marketing_content
SET content_type = CASE type
  WHEN 'social'  THEN 'social_post'
  WHEN 'blog'    THEN 'blog_outline'
  WHEN 'ad_copy' THEN 'google_ad_copy'
  ELSE type
END
WHERE content_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_content_content_type_status
  ON marketing_content (content_type, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. marketing_posts — UI renders text + multi-platform + selected profiles
-- ---------------------------------------------------------------------------
ALTER TABLE marketing_posts
  ADD COLUMN IF NOT EXISTS text        TEXT,
  ADD COLUMN IF NOT EXISTS platforms   TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_ids TEXT[] DEFAULT '{}';

-- Backfill from the legacy single-value columns.
UPDATE marketing_posts
SET text = content
WHERE text IS NULL;

UPDATE marketing_posts
SET platforms = ARRAY[platform]
WHERE (platforms IS NULL OR platforms = '{}') AND platform IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. marketing_google_ads — UI uses unsuffixed money columns + ad creatives
-- ---------------------------------------------------------------------------
ALTER TABLE marketing_google_ads
  ADD COLUMN IF NOT EXISTS daily_budget NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS spend        NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keywords     TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS headlines    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS descriptions TEXT[] DEFAULT '{}';

-- Backfill the unsuffixed money columns from the legacy *_gbp columns.
UPDATE marketing_google_ads
SET daily_budget = daily_budget_gbp
WHERE daily_budget IS NULL;

UPDATE marketing_google_ads
SET spend = spend_gbp
WHERE spend IS NULL OR spend = 0;
