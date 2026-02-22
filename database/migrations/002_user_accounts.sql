-- Migration 002: User accounts, shortlists, and saved searches
-- Run in Supabase SQL Editor after 001 is complete

-- Enable Row Level Security on shortlists
ALTER TABLE user_shortlists ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own shortlist
CREATE POLICY "Users see own shortlist" ON user_shortlists
  FOR ALL USING (auth.uid() = user_id);

-- Policy: users can insert to their own shortlist
CREATE POLICY "Users add to own shortlist" ON user_shortlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  postcode      TEXT NOT NULL,
  radius_km     INTEGER DEFAULT 5,
  grade_filter  TEXT,
  funded_2yr    BOOLEAN DEFAULT FALSE,
  funded_3yr    BOOLEAN DEFAULT FALSE,
  alert_on_new  BOOLEAN DEFAULT FALSE,
  name          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own searches" ON saved_searches
  FOR ALL USING (auth.uid() = user_id);
