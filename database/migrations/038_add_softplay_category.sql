-- Add soft_play category to promotions table

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_category_check;
ALTER TABLE promotions ADD CONSTRAINT promotions_category_check
  CHECK (category IN (
    'swimming', 'music', 'tutoring', 'baby_gear', 'dance',
    'sports', 'soft_play', 'arts', 'language', 'childcare', 'health', 'other'
  ));
