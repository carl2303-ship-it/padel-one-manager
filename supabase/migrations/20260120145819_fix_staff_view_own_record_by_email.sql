/*
  # Fix Staff View Own Record Policy

  1. Problem
    - Staff cannot view their own record when querying by email
    - Current policy only allows viewing by user_id
    - Login check uses email, not user_id

  2. Solution
    - Add policy to allow staff to view record matching their auth email
*/

DROP POLICY IF EXISTS "Staff can view own record" ON club_staff;

CREATE POLICY "Staff can view own record by user_id"
  ON club_staff
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view own record by email"
  ON club_staff
  FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
