-- Provider invite tracking for bulk outreach campaigns
CREATE TABLE IF NOT EXISTS provider_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn         TEXT NOT NULL,
  email       TEXT NOT NULL,
  status      TEXT DEFAULT 'sent' CHECK (status IN ('sent','opened','clicked','claimed')),
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  opened_at   TIMESTAMPTZ,
  clicked_at  TIMESTAMPTZ,
  claimed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provider_invites_urn ON provider_invites(urn);
CREATE INDEX IF NOT EXISTS idx_provider_invites_status ON provider_invites(status);
