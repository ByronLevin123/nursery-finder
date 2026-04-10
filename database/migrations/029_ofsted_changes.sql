-- Track Ofsted rating changes detected during data re-sync
CREATE TABLE IF NOT EXISTS ofsted_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL,
  previous_grade TEXT,
  new_grade TEXT NOT NULL,
  change_date TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_ofsted_changes_nursery ON ofsted_changes (nursery_urn);
CREATE INDEX IF NOT EXISTS idx_ofsted_changes_unnotified ON ofsted_changes (change_date) WHERE notified = false;
