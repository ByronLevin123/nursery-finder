-- Team access for providers — allow multiple users to manage a nursery

CREATE TABLE IF NOT EXISTS nursery_team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'manager', 'viewer')),
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (nursery_urn, user_id)
);

CREATE INDEX IF NOT EXISTS idx_nursery_team_urn ON nursery_team_members (nursery_urn);
CREATE INDEX IF NOT EXISTS idx_nursery_team_user ON nursery_team_members (user_id);

ALTER TABLE nursery_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see teams they belong to" ON nursery_team_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages teams" ON nursery_team_members
  FOR ALL USING (auth.role() = 'service_role');
