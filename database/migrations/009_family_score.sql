-- Migration 009: family_score v2 — crime + IMD + affordability
-- Replaces the original calculate_family_score from migration 003.
-- Score scale changes from 0–10 to 0–100 to preserve finer gradation.

-- 1. Tracking columns
ALTER TABLE postcode_areas
  ADD COLUMN IF NOT EXISTS crime_last_updated TIMESTAMPTZ;

ALTER TABLE postcode_areas
  ADD COLUMN IF NOT EXISTS imd_last_updated TIMESTAMPTZ;

-- 2. Relax the 0..10 constraint so we can store 0..100 scores.
ALTER TABLE postcode_areas
  DROP CONSTRAINT IF EXISTS postcode_areas_family_score_check;

ALTER TABLE postcode_areas
  ALTER COLUMN family_score TYPE DECIMAL(5,1);

ALTER TABLE postcode_areas
  ADD CONSTRAINT postcode_areas_family_score_check
  CHECK (family_score IS NULL OR (family_score BETWEEN 0 AND 100));

-- 3. Per-district function. Tolerates missing components — any null input
--    is excluded from both the average and any data the caller might want.
CREATE OR REPLACE FUNCTION calculate_family_score(district TEXT)
RETURNS DECIMAL(5,1)
LANGUAGE plpgsql
AS $$
DECLARE
  v_area              postcode_areas%ROWTYPE;
  v_nursery_score     DECIMAL;
  v_crime_score       DECIMAL;
  v_deprivation_score DECIMAL;
  v_afford_score      DECIMAL;
  v_sum               DECIMAL := 0;
  v_n                 INTEGER := 0;
  v_final             DECIMAL(5,1);
  v_missing           TEXT[] := ARRAY[]::TEXT[];
  v_breakdown         JSONB;
BEGIN
  SELECT * INTO v_area FROM postcode_areas WHERE postcode_district = district;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Nursery supply + quality (out of 100).
  IF v_area.nursery_count_total IS NOT NULL AND v_area.nursery_count_total > 0 THEN
    v_nursery_score := LEAST(
      100,
      (v_area.nursery_count_total * 2) + COALESCE(v_area.nursery_outstanding_pct, 0)
    );
    v_sum := v_sum + v_nursery_score;
    v_n := v_n + 1;
  ELSE
    v_nursery_score := NULL;
    v_missing := array_append(v_missing, 'nursery');
  END IF;

  -- Crime: lower crime_rate_per_1000 = higher score.
  IF v_area.crime_rate_per_1000 IS NOT NULL THEN
    v_crime_score := GREATEST(0, 100 - LEAST(100, v_area.crime_rate_per_1000 * 10));
    v_sum := v_sum + v_crime_score;
    v_n := v_n + 1;
  ELSE
    v_crime_score := NULL;
    v_missing := array_append(v_missing, 'crime');
  END IF;

  -- Deprivation: IMD decile 1 (most deprived) = 10, decile 10 = 100.
  IF v_area.imd_decile IS NOT NULL THEN
    v_deprivation_score := v_area.imd_decile * 10;
    v_sum := v_sum + v_deprivation_score;
    v_n := v_n + 1;
  ELSE
    v_deprivation_score := NULL;
    v_missing := array_append(v_missing, 'deprivation');
  END IF;

  -- Affordability: £200k baseline → 100, sliding £10k per point.
  IF v_area.asking_price_avg IS NOT NULL THEN
    v_afford_score := GREATEST(
      0,
      LEAST(100, 100 - ((v_area.asking_price_avg - 200000) / 10000.0))
    );
    v_sum := v_sum + v_afford_score;
    v_n := v_n + 1;
  ELSE
    v_afford_score := NULL;
    v_missing := array_append(v_missing, 'affordability');
  END IF;

  IF v_n = 0 THEN
    v_final := NULL;
  ELSE
    v_final := ROUND(v_sum / v_n, 1);
  END IF;

  v_breakdown := jsonb_build_object(
    'nursery',       v_nursery_score,
    'crime',         v_crime_score,
    'deprivation',   v_deprivation_score,
    'affordability', v_afford_score,
    'missing',       to_jsonb(v_missing)
  );

  UPDATE postcode_areas SET
    family_score = v_final,
    family_score_breakdown = v_breakdown,
    updated_at = NOW()
  WHERE postcode_district = district;

  RETURN v_final;
END;
$$;

-- 4. Batch function: same logic in a single set-based UPDATE.
CREATE OR REPLACE FUNCTION calculate_all_family_scores()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH components AS (
    SELECT
      postcode_district,
      CASE
        WHEN nursery_count_total IS NOT NULL AND nursery_count_total > 0
          THEN LEAST(100, (nursery_count_total * 2) + COALESCE(nursery_outstanding_pct, 0))
      END AS nursery_score,
      CASE
        WHEN crime_rate_per_1000 IS NOT NULL
          THEN GREATEST(0, 100 - LEAST(100, crime_rate_per_1000 * 10))
      END AS crime_score,
      CASE
        WHEN imd_decile IS NOT NULL THEN imd_decile * 10
      END AS deprivation_score,
      CASE
        WHEN asking_price_avg IS NOT NULL
          THEN GREATEST(0, LEAST(100, 100 - ((asking_price_avg - 200000) / 10000.0)))
      END AS afford_score
    FROM postcode_areas
  ),
  scored AS (
    SELECT
      postcode_district,
      nursery_score,
      crime_score,
      deprivation_score,
      afford_score,
      (
        SELECT ROUND(AVG(x), 1)::DECIMAL(5,1)
        FROM unnest(ARRAY[nursery_score, crime_score, deprivation_score, afford_score]) AS x
        WHERE x IS NOT NULL
      ) AS final_score,
      ARRAY(
        SELECT k FROM (
          VALUES
            ('nursery', nursery_score),
            ('crime', crime_score),
            ('deprivation', deprivation_score),
            ('affordability', afford_score)
        ) AS t(k, v)
        WHERE v IS NULL
      ) AS missing
    FROM components
  )
  UPDATE postcode_areas p
  SET
    family_score = s.final_score,
    family_score_breakdown = jsonb_build_object(
      'nursery',       s.nursery_score,
      'crime',         s.crime_score,
      'deprivation',   s.deprivation_score,
      'affordability', s.afford_score,
      'missing',       to_jsonb(s.missing)
    ),
    updated_at = NOW()
  FROM scored s
  WHERE p.postcode_district = s.postcode_district;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
