-- Migration 003: Property and area intelligence layer

-- Land Registry price paid (last 3 years only)
CREATE TABLE IF NOT EXISTS land_registry_prices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode            TEXT NOT NULL,
  postcode_district   TEXT NOT NULL,
  price               INTEGER NOT NULL,
  date_of_transfer    DATE NOT NULL,
  property_type       TEXT CHECK (property_type IN ('D','S','T','F','O')),
  new_build           BOOLEAN,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX lr_district_date_idx ON land_registry_prices(postcode_district, date_of_transfer);
CREATE INDEX lr_district_type_idx ON land_registry_prices(postcode_district, property_type);

-- Pre-computed area property stats (refreshed monthly)
CREATE TABLE IF NOT EXISTS area_property_stats (
  postcode_district     TEXT PRIMARY KEY,
  avg_price_all         INTEGER,
  avg_price_flat        INTEGER,
  avg_price_terraced    INTEGER,
  avg_price_semi        INTEGER,
  avg_price_detached    INTEGER,
  median_price          INTEGER,
  transactions_last_12m INTEGER,
  price_change_1yr_pct  DECIMAL(5,2),
  last_calculated       TIMESTAMPTZ DEFAULT NOW()
);

-- Family Score calculation function
CREATE OR REPLACE FUNCTION calculate_family_score(district TEXT)
RETURNS DECIMAL(3,1)
LANGUAGE plpgsql
AS $$
DECLARE
  v_area            postcode_areas%ROWTYPE;
  v_nursery_score   DECIMAL;
  v_safety_score    DECIMAL;
  v_deprivation_score DECIMAL;
  v_flood_score     DECIMAL;
  v_final_score     DECIMAL(3,1);
  v_breakdown       JSONB;
BEGIN
  SELECT * INTO v_area FROM postcode_areas WHERE postcode_district = district;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_nursery_score := COALESCE(
    LEAST(10, (v_area.nursery_outstanding_pct / 100.0) * 10),
    5
  );

  v_safety_score := CASE
    WHEN v_area.crime_rate_per_1000 IS NULL THEN 5
    WHEN v_area.crime_rate_per_1000 < 20 THEN 10
    WHEN v_area.crime_rate_per_1000 < 40 THEN 8
    WHEN v_area.crime_rate_per_1000 < 60 THEN 6
    WHEN v_area.crime_rate_per_1000 < 80 THEN 4
    ELSE 2
  END;

  v_deprivation_score := COALESCE(v_area.imd_decile, 5)::DECIMAL;

  v_flood_score := CASE v_area.flood_risk_level
    WHEN 'Very Low' THEN 10
    WHEN 'Low' THEN 8
    WHEN 'Medium' THEN 5
    WHEN 'High' THEN 2
    ELSE 7
  END;

  v_final_score := ROUND(
    (v_nursery_score     * 0.35) +
    (v_safety_score      * 0.30) +
    (v_deprivation_score * 0.25) +
    (v_flood_score       * 0.10),
  1);

  v_breakdown := jsonb_build_object(
    'nursery',     jsonb_build_object('score', v_nursery_score, 'weight', 0.35),
    'safety',      jsonb_build_object('score', v_safety_score, 'weight', 0.30),
    'deprivation', jsonb_build_object('score', v_deprivation_score, 'weight', 0.25),
    'flood',       jsonb_build_object('score', v_flood_score, 'weight', 0.10)
  );

  UPDATE postcode_areas SET
    family_score = v_final_score,
    family_score_breakdown = v_breakdown,
    updated_at = NOW()
  WHERE postcode_district = district;

  RETURN v_final_score;
END;
$$;
