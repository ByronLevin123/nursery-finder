-- Migration 030: Review moderation enhancements
-- Adds admin_note, moderated_at columns and 'flagged' status to nursery_reviews.

-- Add new columns
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Update the status check constraint to include 'flagged'
-- Drop the old constraint and recreate with the expanded list
ALTER TABLE nursery_reviews DROP CONSTRAINT IF EXISTS nursery_reviews_status_check;
ALTER TABLE nursery_reviews ADD CONSTRAINT nursery_reviews_status_check
  CHECK (status IN ('published', 'pending', 'rejected', 'spam', 'flagged'));

-- Index on status for admin moderation queries
CREATE INDEX IF NOT EXISTS idx_reviews_status ON nursery_reviews (status);
