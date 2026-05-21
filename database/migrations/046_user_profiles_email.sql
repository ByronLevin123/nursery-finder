-- Add email column to user_profiles so admin panel can display it
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (email) WHERE email IS NOT NULL;
