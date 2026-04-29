-- Add 'preview' as allowed plan_type for clubs
-- Preview clubs are visible to players but not yet active on Padel One
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_plan_type_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_plan_type_check CHECK (plan_type IN ('basic', 'pro', 'preview'));
