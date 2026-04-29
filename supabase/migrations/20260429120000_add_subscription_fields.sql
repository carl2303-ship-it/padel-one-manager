-- Add Stripe subscription fields to clubs and organizers
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'year'
  CHECK (billing_interval IN ('month', 'year'));

ALTER TABLE organizers ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'year'
  CHECK (billing_interval IN ('month', 'year'));
