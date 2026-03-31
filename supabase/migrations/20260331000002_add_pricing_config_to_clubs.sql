ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS pricing_config jsonb DEFAULT NULL;

COMMENT ON COLUMN clubs.pricing_config IS 'JSON config for public pricing page: { equipment: [{name, price}], memberships: [{name, description, price, highlight}] }';
