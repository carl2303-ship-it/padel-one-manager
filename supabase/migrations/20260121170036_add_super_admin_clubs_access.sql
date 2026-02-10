/*
  # Add Super Admin Access to Clubs
  
  1. Security
    - Allow super admins to view all clubs
    - Allow super admins to update all clubs
*/

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Super admins can view all clubs" ON clubs;
CREATE POLICY "Super admins can view all clubs"
  ON clubs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can update all clubs" ON clubs;
CREATE POLICY "Super admins can update all clubs"
  ON clubs
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
