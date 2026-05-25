-- Migration 056: Developer platform — API keys, usage tracking, developer accounts.
-- Enables property/real-estate partners to integrate NurseryMatch data via API keys.

-- 1. Developer accounts (linked to existing user_profiles)
CREATE TABLE IF NOT EXISTS developer_accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_name            TEXT NOT NULL,
  website_url             TEXT,
  use_case                TEXT,
  tier                    TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','enterprise')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 2. API keys (one account can have multiple keys)
CREATE TABLE IF NOT EXISTS developer_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    UUID NOT NULL REFERENCES developer_accounts(id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      TEXT NOT NULL,
  label           TEXT DEFAULT 'Default',
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dev_keys_hash ON developer_api_keys(key_hash);

-- 3. Daily usage aggregates (one row per key per day)
CREATE TABLE IF NOT EXISTS developer_api_usage (
  id              BIGSERIAL PRIMARY KEY,
  api_key_id      UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(api_key_id, date)
);

CREATE INDEX IF NOT EXISTS idx_dev_usage_key_date ON developer_api_usage(api_key_id, date);

-- Trigger for updated_at on developer_accounts
DROP TRIGGER IF EXISTS developer_accounts_updated_at ON developer_accounts;
CREATE TRIGGER developer_accounts_updated_at
  BEFORE UPDATE ON developer_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Atomic upsert for daily usage increment (called from backend middleware)
CREATE OR REPLACE FUNCTION increment_developer_usage(p_key_id UUID, p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO developer_api_usage (api_key_id, date, request_count)
  VALUES (p_key_id, p_date, 1)
  ON CONFLICT (api_key_id, date)
  DO UPDATE SET request_count = developer_api_usage.request_count + 1;
END;
$$;
