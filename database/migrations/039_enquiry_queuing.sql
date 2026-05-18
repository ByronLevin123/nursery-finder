-- Add columns needed for enquiry queuing and admin response

-- Allow 'queued' status for unclaimed nursery enquiries
ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_status_check;
ALTER TABLE enquiries ADD CONSTRAINT enquiries_status_check
  CHECK (status IN ('sent', 'queued', 'opened', 'responded', 'visit_booked', 'place_offered', 'accepted', 'declined'));

-- Track which enquiries need admin review
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS requires_admin_review BOOLEAN DEFAULT false;

-- Store parent email so admin can respond directly
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS parent_email TEXT;

-- Allow service role to insert notifications for admin alerts
DROP POLICY IF EXISTS "Service role manages notifications" ON notifications;
CREATE POLICY "Service role manages notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Allow service role to read/write enquiries (for admin endpoints)
DROP POLICY IF EXISTS "Service role manages enquiries" ON enquiries;
CREATE POLICY "Service role manages enquiries" ON enquiries
  FOR ALL USING (auth.role() = 'service_role');
