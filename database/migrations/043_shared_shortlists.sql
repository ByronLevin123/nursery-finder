-- Shared shortlists — persist shortlists with a shareable token

CREATE TABLE IF NOT EXISTS shared_shortlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  urns        TEXT[] NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_shared_shortlists_token ON shared_shortlists (token);

ALTER TABLE shared_shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared shortlists by token" ON shared_shortlists
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create shared shortlists" ON shared_shortlists
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role manages shared shortlists" ON shared_shortlists
  FOR ALL USING (auth.role() = 'service_role');
