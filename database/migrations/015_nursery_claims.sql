-- Migration 015: Nursery claims + provider-editable fields
-- Adds provider claim workflow and provider-managed fields on nurseries.
-- Safe to re-run.

DROP TABLE IF EXISTS nursery_claims CASCADE;

CREATE TABLE nursery_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn             TEXT NOT NULL,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimer_name    TEXT NOT NULL,
  claimer_role    TEXT,
  claimer_email   TEXT NOT NULL,
  claimer_phone   TEXT,
  evidence_notes  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes     TEXT,
  approved_by     UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- One active (non-rejected) claim per (urn, user)
CREATE UNIQUE INDEX IF NOT EXISTS nursery_claims_active_unique
  ON nursery_claims (urn, user_id)
  WHERE status <> 'rejected';

CREATE INDEX IF NOT EXISTS nursery_claims_status_idx ON nursery_claims (status);
CREATE INDEX IF NOT EXISTS nursery_claims_user_idx ON nursery_claims (user_id);

ALTER TABLE nursery_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own claims" ON nursery_claims;
CREATE POLICY "Users see own claims" ON nursery_claims
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own claims" ON nursery_claims;
CREATE POLICY "Users insert own claims" ON nursery_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Provider-editable / claim metadata columns on nurseries
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS opening_hours JSONB;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS photos TEXT[];
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ;
