-- 061_marketing_post_image.sql — store the image attached to a social post.
-- Instagram (and other image-first networks) require an image; we keep the URL
-- on the post record so the admin history shows what was posted. Non-destructive.

ALTER TABLE marketing_posts
  ADD COLUMN IF NOT EXISTS image_url TEXT;
