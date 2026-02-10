/*
  # Add court names selection to tournaments
  
  1. Changes
    - Add `court_names` column to tournaments table (text array)
    - This stores the selected court names from club_courts for this tournament
    
  2. Notes
    - The court names are stored as text to allow matching with match.court field
    - When scheduling matches, the system will use these court names
*/

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS court_names text[] DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN tournaments.court_names IS 'Array of court names selected for this tournament from club_courts';