-- Add user_id column to nursery_reviews for optional auth tracking.
-- Nullable to support anonymous reviews.

ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nursery_reviews_user_id ON nursery_reviews (user_id) WHERE user_id IS NOT NULL;

-- Allow service role full access (for admin moderation endpoints)
ALTER TABLE nursery_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published reviews" ON nursery_reviews;
CREATE POLICY "Anyone can read published reviews" ON nursery_reviews
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Anyone can insert reviews" ON nursery_reviews;
CREATE POLICY "Anyone can insert reviews" ON nursery_reviews
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages reviews" ON nursery_reviews;
CREATE POLICY "Service role manages reviews" ON nursery_reviews
  FOR ALL USING (auth.role() = 'service_role');
