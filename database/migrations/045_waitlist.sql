-- Waitlist management — parents can join waitlist when nursery is full

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id  UUID NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  nursery_urn TEXT NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  child_name  TEXT,
  child_dob   DATE,
  parent_email TEXT,
  age_group   TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'accepted', 'expired', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_waitlist_nursery ON waitlist_entries (nursery_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON waitlist_entries (user_id);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own waitlist entries" ON waitlist_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can join waitlist" ON waitlist_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages waitlist" ON waitlist_entries
  FOR ALL USING (auth.role() = 'service_role');
