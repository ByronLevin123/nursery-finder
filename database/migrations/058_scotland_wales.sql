-- 058_scotland_wales.sql — Add Scotland + Wales childcare support
-- Enables ingesting Care Inspectorate (Scotland) and CIW (Wales) data
-- into the existing nurseries table with country differentiation.

-- 1. Add country column (defaults to 'England' for existing records)
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'England';

-- 2. Add inspection body grade columns for non-Ofsted regulators
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS care_inspectorate_grade TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS ciw_grade TEXT;

-- 3. Add normalised quality tier (1-6) for cross-country grade filtering
-- 1-2 = Inadequate/Unsatisfactory
-- 3   = Requires Improvement / Adequate
-- 4   = Good / Clear Strengths
-- 5   = Very Good / Major Strengths
-- 6   = Outstanding / Excellent / Excellence
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS quality_tier INTEGER
  CHECK (quality_tier BETWEEN 1 AND 6);

-- 4. Add inspection body source for display purposes
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS inspection_body TEXT DEFAULT 'Ofsted';

-- 5. Backfill quality_tier for existing Ofsted records
UPDATE nurseries SET quality_tier = CASE
  WHEN ofsted_overall_grade = 'Outstanding' THEN 6
  WHEN ofsted_overall_grade = 'Good' THEN 4
  WHEN ofsted_overall_grade = 'Requires Improvement' THEN 3
  WHEN ofsted_overall_grade = 'Inadequate' THEN 1
  ELSE NULL
END
WHERE country = 'England' AND quality_tier IS NULL;

-- 6. Backfill country for existing records
UPDATE nurseries SET country = 'England' WHERE country IS NULL;

-- 7. Index for country-filtered spatial searches
CREATE INDEX IF NOT EXISTS idx_nurseries_country
  ON nurseries (country) WHERE registration_status = 'Active' AND location IS NOT NULL;

-- 8. Composite index for country + quality tier filtering
CREATE INDEX IF NOT EXISTS idx_nurseries_country_quality
  ON nurseries (country, quality_tier) WHERE registration_status = 'Active';

-- 9. Update search_nurseries_near to accept optional quality_tier filter
CREATE OR REPLACE FUNCTION search_nurseries_near(
  search_lat          FLOAT,
  search_lng          FLOAT,
  radius_km           FLOAT DEFAULT 5,
  grade_filter        TEXT DEFAULT NULL,
  funded_2yr          BOOLEAN DEFAULT FALSE,
  funded_3yr          BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID, urn TEXT, name TEXT, provider_type TEXT,
  address_line1 TEXT, town TEXT, postcode TEXT, local_authority TEXT,
  ofsted_overall_grade TEXT, last_inspection_date DATE,
  inspection_report_url TEXT, inspection_date_warning BOOLEAN,
  enforcement_notice BOOLEAN, total_places INTEGER,
  places_funded_2yr INTEGER, places_funded_3_4yr INTEGER,
  google_rating DECIMAL, google_review_count INTEGER,
  fee_avg_monthly INTEGER, fee_report_count INTEGER,
  lat DECIMAL, lng DECIMAL, distance_km FLOAT,
  country TEXT, quality_tier INTEGER, inspection_body TEXT,
  care_inspectorate_grade TEXT, ciw_grade TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.id, n.urn, n.name, n.provider_type,
    n.address_line1, n.town, n.postcode, n.local_authority,
    n.ofsted_overall_grade, n.last_inspection_date,
    n.inspection_report_url, n.inspection_date_warning,
    n.enforcement_notice, n.total_places,
    n.places_funded_2yr, n.places_funded_3_4yr,
    n.google_rating, n.google_review_count,
    n.fee_avg_monthly, n.fee_report_count,
    n.lat, n.lng,
    ST_Distance(
      n.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
    ) / 1000.0 AS distance_km,
    n.country, n.quality_tier, n.inspection_body,
    n.care_inspectorate_grade, n.ciw_grade
  FROM nurseries n
  WHERE
    n.registration_status = 'Active'
    AND n.location IS NOT NULL
    AND n.location && ST_Expand(
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
      radius_km / 111.0
    )
    AND ST_DWithin(
      n.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (grade_filter IS NULL OR n.ofsted_overall_grade = grade_filter
         OR n.quality_tier = CASE
           WHEN grade_filter = 'Outstanding' THEN 6
           WHEN grade_filter = 'Good' THEN 4
           WHEN grade_filter = 'Requires Improvement' THEN 3
           WHEN grade_filter = 'Inadequate' THEN 1
           ELSE NULL END)
    AND (NOT funded_2yr OR n.places_funded_2yr > 0)
    AND (NOT funded_3yr OR n.places_funded_3_4yr > 0)
  ORDER BY distance_km ASC
  LIMIT 100;
$$;
