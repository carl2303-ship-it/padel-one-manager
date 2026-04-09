-- Add HQ management columns to clubs table

-- Club status: active or suspended by super admin
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));

-- Plan type: basic or pro
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'basic'
  CHECK (plan_type IN ('basic', 'pro'));

-- Tour license: whether the club can create/manage tournaments
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS tour_license_active boolean NOT NULL DEFAULT false;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_clubs_status ON clubs(status);
CREATE INDEX IF NOT EXISTS idx_clubs_plan_type ON clubs(plan_type);
