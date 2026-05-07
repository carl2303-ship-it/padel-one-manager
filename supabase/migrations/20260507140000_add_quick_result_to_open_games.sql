-- Add is_quick_result flag to open_games for games created just to record results
ALTER TABLE open_games ADD COLUMN IF NOT EXISTS is_quick_result BOOLEAN DEFAULT false;

-- Allow authenticated users to insert completed quick-result games directly
-- (the existing RLS policies already allow creator to insert, this just ensures status='completed' is valid at insert)
