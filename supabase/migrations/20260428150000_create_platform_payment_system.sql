-- Platform Payment & License System
-- Creates tables for Stripe config, plans, license keys, and payments

-- 1. Platform Stripe Configuration (Padel One's own Stripe credentials)
CREATE TABLE IF NOT EXISTS platform_stripe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_publishable_key text NOT NULL,
  stripe_secret_key text NOT NULL,
  webhook_secret text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE platform_stripe_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage platform stripe config"
  ON platform_stripe_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- 2. Platform Plans (pricing for clubs and organizers)
CREATE TABLE IF NOT EXISTS platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('club', 'organizer')),
  price_monthly numeric(10,2),
  price_annual numeric(10,2),
  is_active boolean DEFAULT true,
  features jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE platform_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON platform_plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage plans"
  ON platform_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- 3. License Keys
CREATE TABLE IF NOT EXISTS license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text UNIQUE NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('club', 'organizer')),
  plan_name text NOT NULL,
  duration_months int NOT NULL DEFAULT 12,
  target_user_id uuid REFERENCES auth.users(id),
  target_entity_id uuid,
  stripe_payment_id text,
  custom_price numeric(10,2),
  status text DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  activated_at timestamptz,
  activated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage license keys"
  ON license_keys FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

CREATE POLICY "Users can read their own license keys"
  ON license_keys FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR activated_by = auth.uid());

-- 4. Platform Payments (history)
CREATE TABLE IF NOT EXISTS platform_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_id uuid REFERENCES license_keys(id),
  stripe_session_id text,
  stripe_payment_intent text,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'eur',
  target_type text NOT NULL CHECK (target_type IN ('club', 'organizer')),
  target_entity_id uuid,
  payer_email text,
  payer_name text,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE platform_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage platform payments"
  ON platform_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- 5. Add contract dates to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contract_start timestamptz;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contract_expires_at timestamptz;

-- 6. Add contract_start to organizers (already has subscription_expires_at)
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS contract_start timestamptz;

-- Seed default plans
INSERT INTO platform_plans (name, target_type, price_monthly, price_annual, is_active, features) VALUES
  ('Basic', 'club', 29.99, 299.99, true, '{"max_courts": 4, "bar_module": true, "tour_license": false}'),
  ('Pro', 'club', 79.99, 799.99, true, '{"max_courts": 12, "bar_module": true, "tour_license": true, "analytics": true}'),
  ('Bronze', 'organizer', 9.99, 99.99, true, '{"max_players_per_tournament": 32, "max_tournaments_month": 2}'),
  ('Silver', 'organizer', 19.99, 199.99, true, '{"max_players_per_tournament": 64, "max_tournaments_month": 5}'),
  ('Gold', 'organizer', 39.99, 399.99, true, '{"max_players_per_tournament": 128, "max_tournaments_month": -1}')
ON CONFLICT DO NOTHING;
