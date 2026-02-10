/*
  # Add sort_order to club_courts table

  1. Changes
    - Add `sort_order` column to `club_courts` table
    - Default value is 0
    - Allows organizers to customize the display order of courts

  2. Notes
    - Existing courts will have sort_order = 0 by default
    - Lower numbers appear first
*/

ALTER TABLE club_courts
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
