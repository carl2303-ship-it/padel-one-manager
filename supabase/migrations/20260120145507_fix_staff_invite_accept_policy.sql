/*
  # Fix Staff Invite Accept Policy

  1. Problem
    - Current policy requires invite_token IS NOT NULL in WITH CHECK
    - This prevents setting invite_token to NULL when accepting the invite

  2. Solution
    - Update the policy to allow setting invite_token to NULL when accepting
    - The USING clause still ensures only valid invites can be updated
*/

DROP POLICY IF EXISTS "Anon can update staff to accept invite" ON club_staff;

CREATE POLICY "Anon can update staff to accept invite"
  ON club_staff
  FOR UPDATE
  TO anon
  USING (
    invite_token IS NOT NULL 
    AND invite_expires_at > now()
  )
  WITH CHECK (true);

CREATE POLICY "Authenticated can update staff to accept invite"
  ON club_staff
  FOR UPDATE
  TO authenticated
  USING (
    invite_token IS NOT NULL 
    AND invite_expires_at > now()
  )
  WITH CHECK (true);
