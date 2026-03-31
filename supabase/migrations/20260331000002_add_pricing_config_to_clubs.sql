ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS pricing_config jsonb DEFAULT NULL;

COMMENT ON COLUMN clubs.pricing_config IS 'JSON config for public pricing page: { equipment: [{name, price}] }';

ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS show_on_pricing boolean DEFAULT true;

COMMENT ON COLUMN membership_plans.show_on_pricing IS 'Whether this plan appears on the public pricing page';

ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
