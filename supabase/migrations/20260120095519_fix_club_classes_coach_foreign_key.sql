/*
  # Fix club_classes coach foreign key

  1. Changes
    - Drop the foreign key constraint from club_coaches table
    - Add new foreign key constraint to club_staff table
    - This allows coaches from the staff table to be assigned to classes
  
  2. Details
    - The coach_id column now references club_staff instead of club_coaches
    - ON DELETE SET NULL ensures classes remain if a coach is removed
*/

ALTER TABLE club_classes
  DROP CONSTRAINT IF EXISTS club_classes_coach_id_fkey;

ALTER TABLE club_classes
  ADD CONSTRAINT club_classes_coach_id_fkey 
  FOREIGN KEY (coach_id) 
  REFERENCES club_staff(id) 
  ON DELETE SET NULL;