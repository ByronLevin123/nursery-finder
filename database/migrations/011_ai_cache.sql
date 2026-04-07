-- 011_ai_cache.sql — cache table for Claude-generated content
-- Keyed by feature + entity (e.g. "nursery_summary:EY100001")

CREATE TABLE IF NOT EXISTS ai_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_content_cache_key_idx ON ai_content_cache (cache_key);
CREATE INDEX IF NOT EXISTS ai_content_cache_expires_idx ON ai_content_cache (expires_at);
