-- Enable Row-Level Security on subscription tables to prevent
-- users from querying other users' billing data via Supabase client.

ALTER TABLE provider_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own provider subscription"
  ON provider_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses provider subscription RLS"
  ON provider_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE parent_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own parent subscription"
  ON parent_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role bypasses parent subscription RLS"
  ON parent_subscriptions FOR ALL
  USING (auth.role() = 'service_role');
