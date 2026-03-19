-- Add per-court slot configuration (replaces global operating hours)
-- Each court now has its own slots with configurable durations

-- court_slots is a JSONB column with structure:
-- {
--   "operating_start": "08:00",
--   "operating_end": "22:00", 
--   "slots": [
--     { "time": "08:00", "durations": [60, 90, 120] },
--     { "time": "08:30", "durations": [60, 90] },
--     ...
--   ]
-- }
ALTER TABLE club_courts
ADD COLUMN IF NOT EXISTS court_slots jsonb DEFAULT NULL;

-- Add global operating hours to clubs table (for display on Player App)
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS opening_time text DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS closing_time text DEFAULT '22:00';
