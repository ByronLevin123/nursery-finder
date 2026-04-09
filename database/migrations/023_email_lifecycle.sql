-- Email lifecycle: event log, drip sequences, email preferences
-- Migration 023

-- Email event log (tracks all transactional emails sent)
CREATE TABLE IF NOT EXISTS email_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_to    TEXT NOT NULL,
  template    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  status      TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','bounced','failed')),
  resend_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_template ON email_log(template);

-- Drip sequence tracking
CREATE TABLE IF NOT EXISTS drip_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence    TEXT NOT NULL,
  step        INTEGER NOT NULL DEFAULT 0,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  next_send_at TIMESTAMPTZ,
  completed   BOOLEAN DEFAULT false,
  paused      BOOLEAN DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drip_user_seq ON drip_sequences(user_id, sequence);
CREATE INDEX IF NOT EXISTS idx_drip_next_send ON drip_sequences(next_send_at) WHERE completed = false AND paused = false;

-- Add email preferences to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_weekly_digest BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_new_nurseries BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_marketing BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
