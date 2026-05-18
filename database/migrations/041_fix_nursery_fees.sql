-- Fix nursery_fees table to support anonymous fee submissions.
-- The table may have been created by migration 027 with price_gbp/session_type
-- but the API endpoint uses nursery_urn + fee_per_month. Ensure both columns exist.

ALTER TABLE nursery_fees ADD COLUMN IF NOT EXISTS nursery_urn TEXT;
ALTER TABLE nursery_fees ADD COLUMN IF NOT EXISTS fee_per_month INTEGER;
ALTER TABLE nursery_fees ADD COLUMN IF NOT EXISTS hours_per_week INTEGER;

-- Make session_type and age_group nullable for anonymous submissions
ALTER TABLE nursery_fees ALTER COLUMN session_type DROP NOT NULL;
ALTER TABLE nursery_fees ALTER COLUMN age_group DROP NOT NULL;

-- Allow anonymous inserts (no auth required for fee crowdsourcing)
ALTER TABLE nursery_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert fees" ON nursery_fees;
CREATE POLICY "Anyone can insert fees" ON nursery_fees
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can read fees" ON nursery_fees;
CREATE POLICY "Anyone can read fees" ON nursery_fees
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role manages fees" ON nursery_fees;
CREATE POLICY "Service role manages fees" ON nursery_fees
  FOR ALL USING (auth.role() = 'service_role');
