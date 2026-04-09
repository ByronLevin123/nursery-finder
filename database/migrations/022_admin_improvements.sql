-- Migration 022: Admin dashboard improvements
-- Adds flagged_at/flagged_by to nursery_reviews and indexes for moderation queries.

-- Add flagged columns to nursery_reviews
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES auth.users(id);

-- Index on nursery_reviews(status) for fast moderation queue queries
CREATE INDEX IF NOT EXISTS idx_nursery_reviews_status ON nursery_reviews(status);

-- Index on nursery_claims(status) for fast admin claims queue queries
CREATE INDEX IF NOT EXISTS idx_nursery_claims_status ON nursery_claims(status);
