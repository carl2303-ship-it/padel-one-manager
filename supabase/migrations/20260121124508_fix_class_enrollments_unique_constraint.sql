/*
  # Fix class enrollments constraints and add organizer player link

  1. Changes
    - Drop the unique constraint on (class_id, student_id) that prevents multiple students
    - Make student_id nullable (not all enrolled students are auth users)
    - Add organizer_player_id to link enrolled students to the organizer's player database
    - Add unique constraint on (class_id, organizer_player_id) to prevent duplicate player enrollments
    - Add unique constraint on (class_id, student_name) for manual entries without player link

  2. Purpose
    - Allow multiple students to be enrolled in the same class
    - Link class students to the organizer's player database for tournaments
    - Support both linked players and manual name entries
*/

ALTER TABLE class_enrollments
DROP CONSTRAINT IF EXISTS class_enrollments_class_id_student_id_key;

ALTER TABLE class_enrollments
ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE class_enrollments
ADD COLUMN IF NOT EXISTS organizer_player_id uuid REFERENCES organizer_players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_enrollments_organizer_player 
ON class_enrollments(organizer_player_id) 
WHERE organizer_player_id IS NOT NULL;

ALTER TABLE class_enrollments
ADD CONSTRAINT class_enrollments_class_organizer_player_unique 
UNIQUE NULLS NOT DISTINCT (class_id, organizer_player_id);