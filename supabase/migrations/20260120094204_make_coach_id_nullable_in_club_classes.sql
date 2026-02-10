/*
  # Make coach_id nullable in club_classes

  1. Changes
    - Alter club_classes table to make coach_id nullable
    - This allows creating classes without immediately assigning a coach
  
  2. Reasoning
    - Not all classes need to have a coach assigned when first created
    - Club owners may want to schedule classes and assign coaches later
    - Prevents foreign key constraint errors when no coaches exist yet
*/

ALTER TABLE club_classes 
  ALTER COLUMN coach_id DROP NOT NULL;