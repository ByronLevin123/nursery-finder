-- Migration 007: Anonymous parent reviews
-- Adds the nursery_reviews table, aggregate columns on nurseries, and a
-- refresh function + trigger that keeps the aggregates in sync.

-- Drop any half-created table from an earlier failed run, then recreate fresh.
DROP TABLE IF EXISTS nursery_reviews CASCADE;

-- 1. Reviews table -----------------------------------------------------------
-- urn is not a foreign key: nurseries.urn has no unique constraint on some
-- environments, and orphan prevention is handled at the application layer.
CREATE TABLE nursery_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn                 TEXT NOT NULL,
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body                TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 4000),
  would_recommend     BOOLEAN NOT NULL,
  child_age_months    SMALLINT CHECK (child_age_months BETWEEN 0 AND 72),
  attended_from       DATE,
  attended_to         DATE,
  author_display_name TEXT,
  ip_hash             TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'published'
                      CHECK (status IN ('published','pending','rejected','spam')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursery_reviews_urn_status_created
  ON nursery_reviews (urn, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nursery_reviews_ip_hash_created
  ON nursery_reviews (ip_hash, created_at);

-- 2. Aggregate columns on nurseries -----------------------------------------
ALTER TABLE nurseries
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_avg_rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS review_recommend_pct DECIMAL(5,2);

-- 3. Refresh function --------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_nursery_review_stats(target_urn TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF target_urn IS NOT NULL THEN
    UPDATE nurseries n
    SET review_count = COALESCE(s.cnt, 0),
        review_avg_rating = s.avg_rating,
        review_recommend_pct = s.recommend_pct
    FROM (
      SELECT
        COUNT(*)::INTEGER AS cnt,
        ROUND(AVG(rating)::numeric, 2) AS avg_rating,
        ROUND(
          (100.0 * SUM(CASE WHEN would_recommend THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::numeric,
          2
        ) AS recommend_pct
      FROM nursery_reviews
      WHERE urn = target_urn AND status = 'published'
    ) s
    WHERE n.urn = target_urn;
  ELSE
    UPDATE nurseries n
    SET review_count = COALESCE(s.cnt, 0),
        review_avg_rating = s.avg_rating,
        review_recommend_pct = s.recommend_pct
    FROM (
      SELECT
        urn,
        COUNT(*)::INTEGER AS cnt,
        ROUND(AVG(rating)::numeric, 2) AS avg_rating,
        ROUND(
          (100.0 * SUM(CASE WHEN would_recommend THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::numeric,
          2
        ) AS recommend_pct
      FROM nursery_reviews
      WHERE status = 'published'
      GROUP BY urn
    ) s
    WHERE n.urn = s.urn;
  END IF;
END;
$$;

-- 4. Trigger -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION nursery_reviews_refresh_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_nursery_review_stats(COALESCE(NEW.urn, OLD.urn));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS nursery_reviews_refresh_stats ON nursery_reviews;
CREATE TRIGGER nursery_reviews_refresh_stats
AFTER INSERT OR UPDATE OR DELETE ON nursery_reviews
FOR EACH ROW
EXECUTE FUNCTION nursery_reviews_refresh_stats_trigger();
