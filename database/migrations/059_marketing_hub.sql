-- 059_marketing_hub.sql — Marketing Hub tables
-- Tracks social media posts (via Buffer), Google Ads campaigns, and AI-generated content.

-- 1. Social media posts (Buffer integration)
CREATE TABLE IF NOT EXISTS marketing_posts (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content         TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('twitter','facebook','instagram','linkedin','tiktok')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','posted','failed')),
  buffer_post_id  TEXT,
  scheduled_at    TIMESTAMPTZ,
  posted_at       TIMESTAMPTZ,
  impressions     INTEGER DEFAULT 0,
  engagement      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_status
  ON marketing_posts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_platform
  ON marketing_posts (platform, created_at DESC);

-- 2. Google Ads campaigns
CREATE TABLE IF NOT EXISTS marketing_google_ads (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                TEXT NOT NULL,
  google_campaign_id  TEXT,
  daily_budget_gbp    NUMERIC(10,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','enabled','paused','removed')),
  impressions         INTEGER DEFAULT 0,
  clicks              INTEGER DEFAULT 0,
  conversions         INTEGER DEFAULT 0,
  spend_gbp           NUMERIC(10,2) DEFAULT 0,
  synced_at           TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_google_ads_status
  ON marketing_google_ads (status, created_at DESC);

-- 3. AI-generated content drafts
CREATE TABLE IF NOT EXISTS marketing_content (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('social','blog','email','ad_copy')),
  prompt_used   TEXT,
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published')),
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_content_type_status
  ON marketing_content (type, status, created_at DESC);
