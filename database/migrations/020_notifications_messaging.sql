-- 020: Notifications + enquiry messaging threads
-- Run after 019_visit_booking.sql

-- Enquiry messages (threaded conversation between parent and provider)
CREATE TABLE IF NOT EXISTS enquiry_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id  UUID REFERENCES enquiries(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('parent','provider')),
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_messages_enquiry ON enquiry_messages(enquiry_id, created_at);

ALTER TABLE enquiry_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enquiry participants see messages" ON enquiry_messages;
CREATE POLICY "Enquiry participants see messages" ON enquiry_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    enquiry_id IN (SELECT id FROM enquiries WHERE user_id = auth.uid()) OR
    enquiry_id IN (
      SELECT e.id FROM enquiries e
      JOIN nurseries n ON n.id = e.nursery_id
      JOIN nursery_claims nc ON nc.urn = n.urn
      WHERE nc.user_id = auth.uid() AND nc.status = 'approved'
    )
  );
DROP POLICY IF EXISTS "Enquiry participants send messages" ON enquiry_messages;
CREATE POLICY "Enquiry participants send messages" ON enquiry_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read_at     TIMESTAMPTZ,
  email_sent  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
