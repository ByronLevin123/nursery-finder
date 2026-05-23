-- Add campaign_type to provider_invites so we can distinguish
-- invite-to-claim emails from general awareness campaigns.
ALTER TABLE provider_invites ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'invite';
