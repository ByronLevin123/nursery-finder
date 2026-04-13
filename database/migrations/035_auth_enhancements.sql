-- Migration 035: Auth enhancements
-- Ensure user_profiles has email, full_name, phone columns
-- (may already exist from app-level upserts).
-- Safe to re-run.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
