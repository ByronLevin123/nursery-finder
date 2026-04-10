-- 027_enhanced_listings.sql — Photo gallery, enhanced descriptions, fee management for paid providers
-- Run once against Supabase SQL editor.

-- Nursery photo gallery table
CREATE TABLE IF NOT EXISTS nursery_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn     TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  public_url      TEXT NOT NULL,
  display_order   INTEGER DEFAULT 0,
  caption         TEXT,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursery_photos_urn ON nursery_photos (nursery_urn);

-- Add enhanced listing feature flags to tier_limits
ALTER TABLE tier_limits ADD COLUMN IF NOT EXISTS photo_gallery BOOLEAN DEFAULT false;
ALTER TABLE tier_limits ADD COLUMN IF NOT EXISTS custom_description BOOLEAN DEFAULT false;
ALTER TABLE tier_limits ADD COLUMN IF NOT EXISTS fee_management BOOLEAN DEFAULT false;

-- Update tier_limits rows with enhanced listing features
UPDATE tier_limits SET photo_gallery = false, custom_description = false, fee_management = false WHERE tier = 'free';
UPDATE tier_limits SET photo_gallery = true,  custom_description = true,  fee_management = true  WHERE tier = 'pro';
UPDATE tier_limits SET photo_gallery = true,  custom_description = true,  fee_management = true  WHERE tier = 'premium';

-- Provider-managed fees table
CREATE TABLE IF NOT EXISTS nursery_fees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn     TEXT NOT NULL,
  age_group       TEXT NOT NULL,
  session_type    TEXT NOT NULL,
  price_gbp       NUMERIC(8,2) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursery_fees_urn ON nursery_fees (nursery_urn);
