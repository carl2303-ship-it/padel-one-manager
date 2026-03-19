-- Add active_schedule to clubs for winter/summer schedule switching
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS active_schedule text NOT NULL DEFAULT 'summer' CHECK (active_schedule IN ('summer', 'winter'));
