/*
  # Fix Staff Invite View Policy

  1. Problem
    - Current policy only allows anon users to view staff by invite token
    - Authenticated users cannot view their own invite

  2. Solution
    - Add policy for authenticated users to view staff by invite token
    - This allows users to view their invite even if already logged in
*/

-- Add policy for authenticated users to view staff by invite token
DROP POLICY IF EXISTS "Authenticated can view staff by invite token" ON club_staff;
CREATE POLICY "Authenticated can view staff by invite token"
  ON club_staff
  FOR SELECT
  TO authenticated
  USING (invite_token IS NOT NULL AND invite_expires_at > now());
