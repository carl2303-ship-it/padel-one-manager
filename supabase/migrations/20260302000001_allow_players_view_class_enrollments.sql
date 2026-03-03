/*
  # Allow players to view class enrollments for available classes

  1. Changes
    - Add RLS policy to allow authenticated users to view ALL enrollments for scheduled classes
    - This allows players in the Player app to see who is enrolled in classes before enrolling
    - Only applies to scheduled (future) classes, not past classes
    - This policy works alongside the existing "Students can view their own enrollments" policy

  2. Security
    - Users can only VIEW enrollments, not modify them (unless they are club owners)
    - Only applies to classes with status 'scheduled' and future dates
    - This is safe because it only allows viewing, not modifying or deleting
*/

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Players can view enrollments for scheduled classes" ON class_enrollments;

-- Create policy to allow all authenticated users to view enrollments for scheduled classes
CREATE POLICY "Players can view enrollments for scheduled classes"
  ON class_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_classes
      WHERE club_classes.id = class_enrollments.class_id
      AND club_classes.status = 'scheduled'
      AND club_classes.scheduled_at >= now()
    )
  );
