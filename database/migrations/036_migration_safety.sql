-- Migration 036: Migration safety guard
-- Protects against accidental re-runs of destructive migrations.
--
-- WARNING: The following older migrations contain destructive operations:
--   005_land_registry_unique.sql  — TRUNCATE land_registry_prices
--   007_reviews.sql               — DROP TABLE IF EXISTS nursery_reviews CASCADE
--   015_nursery_claims.sql        — DROP TABLE IF EXISTS nursery_claims CASCADE
--   034_free_parents_promotions.sql — DROP TABLE IF EXISTS parent_subscriptions
--
-- These are safe for initial setup but MUST NOT be re-run on a live database
-- with real data. This migration adds a guard table to prevent that.

-- Create a migration lock table to track which migrations have been applied.
-- If this table exists with rows, destructive migrations should be skipped.
CREATE TABLE IF NOT EXISTS _migration_guard (
  id          SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a guard row — if this row exists, the database has live data.
INSERT INTO _migration_guard (description)
SELECT 'Production data initialized — do not re-run destructive migrations (005, 007, 015, 034)'
WHERE NOT EXISTS (SELECT 1 FROM _migration_guard WHERE id = 1);

-- Add a comment to the table for documentation
COMMENT ON TABLE _migration_guard IS
  'Safety guard: presence of rows means database has production data. Never re-run DROP/TRUNCATE migrations.';
