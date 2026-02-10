/*
  # Add level and gender fields to club_classes
  
  1. Changes
    - Add `level` field to club_classes (text, nullable) - e.g., "0-7", "0-3", "5-7"
    - Add `gender` field to club_classes (text, nullable) - "M", "F", or "Misto"
    - These fields allow filtering classes by player level and gender preference
  
  2. Reasoning
    - Players need to see classes that match their skill level
    - Gender-specific classes (masculino, feminino) or mixed (misto) are common
    - These fields help players find appropriate classes in the player app
*/

ALTER TABLE club_classes 
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('M', 'F', 'Misto')) DEFAULT 'Misto';

-- Add comment for documentation
COMMENT ON COLUMN club_classes.level IS 'Player level range accepted for this class (e.g., "0-7", "0-3", "5-7")';
COMMENT ON COLUMN club_classes.gender IS 'Gender restriction: M (Masculino), F (Feminino), or Misto (Mixed)';
