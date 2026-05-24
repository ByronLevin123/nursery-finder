-- Add source column to nursery_reviews so we can distinguish
-- NurseryMatch parent reviews from Google reviews.
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'nurserymatch';
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS google_review_id TEXT;

-- Google reviews don't have all the same constraints as parent reviews,
-- so relax the NOT NULL on ip_hash for imported reviews.
ALTER TABLE nursery_reviews ALTER COLUMN ip_hash DROP NOT NULL;

-- Prevent duplicate Google review imports.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nursery_reviews_google_id
  ON nursery_reviews (google_review_id) WHERE google_review_id IS NOT NULL;
