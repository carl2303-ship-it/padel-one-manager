/*
  # Fix class_enrollments unique constraint
  
  The NULLS NOT DISTINCT constraint on (class_id, organizer_player_id) 
  prevents multiple students from being enrolled when they have NULL organizer_player_id
  (e.g., when they are linked via member_subscription_id instead).
  
  Fix: Change to regular UNIQUE which treats NULLs as distinct in PostgreSQL.
*/

ALTER TABLE class_enrollments
DROP CONSTRAINT IF EXISTS class_enrollments_class_organizer_player_unique;

ALTER TABLE class_enrollments
ADD CONSTRAINT class_enrollments_class_organizer_player_unique 
UNIQUE (class_id, organizer_player_id);
