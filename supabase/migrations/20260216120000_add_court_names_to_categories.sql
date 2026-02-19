/*
  # Add Court Names to Tournament Categories
  
  1. Changes
    - Add `court_names` column to tournament_categories table to allow specific courts per category
    - This enables independent scheduling for different categories on different courts
    - Example: Category M3-M4 uses ["Campo 1", "Campo 2"], Category M5-M6 uses ["Campo 3", "Campo 4"]
*/

-- Add court_names column to tournament_categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_categories' AND column_name = 'court_names'
  ) THEN
    ALTER TABLE tournament_categories ADD COLUMN court_names text[] DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN tournament_categories.court_names IS 'Array of court names assigned to this category. If NULL, uses all tournament courts.';
