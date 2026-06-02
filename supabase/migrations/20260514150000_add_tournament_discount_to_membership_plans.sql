-- Add tournament discount percentage to membership plans
DO $$ BEGIN
  ALTER TABLE membership_plans
    ADD COLUMN tournament_discount_percent integer NOT NULL DEFAULT 0
    CHECK (tournament_discount_percent >= 0 AND tournament_discount_percent <= 100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
