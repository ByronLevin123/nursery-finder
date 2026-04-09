-- 021_monetization.sql — Provider + Parent subscription tiers, Stripe integration
-- Run once against Supabase SQL editor.

-- Provider subscription tiers
CREATE TABLE IF NOT EXISTS provider_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','premium')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','trialing')),
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,
  enquiry_credits       INTEGER DEFAULT 5,
  enquiry_credits_used  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_sub_user ON provider_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_sub_stripe ON provider_subscriptions(stripe_customer_id);

-- Parent premium subscriptions
CREATE TABLE IF NOT EXISTS parent_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','trialing')),
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_sub_user ON parent_subscriptions(user_id);

-- Featured listing flag on nurseries
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS provider_tier TEXT DEFAULT 'free';

-- Provider tier feature limits
CREATE TABLE IF NOT EXISTS tier_limits (
  tier            TEXT PRIMARY KEY,
  monthly_price_gbp INTEGER NOT NULL,
  enquiry_credits INTEGER NOT NULL,
  featured_listing BOOLEAN DEFAULT false,
  analytics_advanced BOOLEAN DEFAULT false,
  priority_search BOOLEAN DEFAULT false,
  custom_branding BOOLEAN DEFAULT false,
  description     TEXT
);

INSERT INTO tier_limits (tier, monthly_price_gbp, enquiry_credits, featured_listing, analytics_advanced, priority_search, custom_branding, description) VALUES
  ('free', 0, 5, false, false, false, false, 'Basic listing with 5 enquiry views/month'),
  ('pro', 29, 50, true, true, true, false, 'Featured listing, priority search, 50 enquiry views/month'),
  ('premium', 79, -1, true, true, true, true, 'Unlimited enquiries, custom branding, all features')
ON CONFLICT (tier) DO NOTHING;
