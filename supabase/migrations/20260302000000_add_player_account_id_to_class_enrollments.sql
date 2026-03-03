/*
  # Add player_account_id to class_enrollments

  1. Changes
    - Add `player_account_id` column to `class_enrollments` table
    - This allows direct linking to player_accounts (primary ID) instead of just user_id
    - Makes it easier to fetch player data and avatars

  2. Security
    - No RLS changes needed - existing policies cover this table
*/

ALTER TABLE class_enrollments
ADD COLUMN IF NOT EXISTS player_account_id uuid REFERENCES player_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_enrollments_player_account 
ON class_enrollments(player_account_id) 
WHERE player_account_id IS NOT NULL;

-- Update existing enrollments that have student_id to also have player_account_id
UPDATE class_enrollments ce
SET player_account_id = pa.id
FROM player_accounts pa
WHERE ce.student_id = pa.user_id
  AND ce.player_account_id IS NULL
  AND ce.student_id IS NOT NULL;
