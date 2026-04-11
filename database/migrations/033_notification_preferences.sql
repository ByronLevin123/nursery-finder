CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_new_review BOOLEAN DEFAULT true,
  email_qa_answer BOOLEAN DEFAULT true,
  email_saved_search_alert BOOLEAN DEFAULT true,
  email_ofsted_change BOOLEAN DEFAULT true,
  email_weekly_digest BOOLEAN DEFAULT false,
  email_marketing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_prefs_user ON notification_preferences (user_id);
