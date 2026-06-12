-- 062_schema_migrations.sql — migration tracking table.
-- Populated by backend/scripts/migrate.js. Lets us answer "what's applied?"
-- without a manual audit. Idempotent; safe to run more than once.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  checksum   TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
