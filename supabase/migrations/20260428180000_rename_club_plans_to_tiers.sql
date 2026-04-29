-- Rename club plan_type from basic/pro to bronze/silver/gold (matching organizer tiers)

-- 1. Drop existing constraint
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_plan_type_check;

-- 2. Rename existing values
UPDATE clubs SET plan_type = 'bronze' WHERE plan_type = 'basic';
UPDATE clubs SET plan_type = 'silver' WHERE plan_type = 'pro';

-- 3. Add new constraint with bronze, silver, gold, preview
ALTER TABLE clubs ADD CONSTRAINT clubs_plan_type_check 
  CHECK (plan_type IN ('bronze', 'silver', 'gold', 'preview'));

-- 4. Update platform_plans: rename club plans and add Gold
UPDATE platform_plans SET name = 'Bronze' WHERE name = 'Basic' AND target_type = 'club';
UPDATE platform_plans SET name = 'Silver' WHERE name = 'Pro' AND target_type = 'club';

INSERT INTO platform_plans (name, target_type, price_monthly, price_annual, is_active, features)
VALUES ('Gold', 'club', 149.99, 1499.99, true, '{"max_courts": -1, "bar_module": true, "tour_license": true, "analytics": true, "priority_support": true}')
ON CONFLICT DO NOTHING;
