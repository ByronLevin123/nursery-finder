-- Migration 016: User roles (customer / provider / admin)
-- Safe to re-run.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

-- Drop old constraint if present, then re-add
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('customer','provider','admin'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- When a claim is approved, auto-promote the user to 'provider' (idempotent).
CREATE OR REPLACE FUNCTION public.promote_on_claim_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.user_profiles
       SET role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'provider' END,
           updated_at = NOW()
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_claim_approved ON nursery_claims;
CREATE TRIGGER on_claim_approved
  AFTER UPDATE ON nursery_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_on_claim_approval();

-- Allow users to read their own role (covered by existing SELECT policy on user_profiles)
-- Admins read all profiles:
DROP POLICY IF EXISTS "Admins read all profiles" ON user_profiles;
CREATE POLICY "Admins read all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
