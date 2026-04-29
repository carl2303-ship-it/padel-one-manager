-- Add organizer_tier column to organizers table
-- Three tiers: bronze, silver, gold with different permission levels
ALTER TABLE organizers
ADD COLUMN IF NOT EXISTS organizer_tier text DEFAULT 'bronze'
CHECK (organizer_tier IN ('bronze', 'silver', 'gold'));

-- Set existing organizers without a tier to bronze
UPDATE organizers SET organizer_tier = 'bronze' WHERE organizer_tier IS NULL;
