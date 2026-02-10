/*
  # Add function to get organizer emails for Super Admin

  1. Functions
    - `get_organizer_emails` - Returns user IDs and emails for given organizer IDs
  
  2. Security
    - Function only accessible by super admins
    - Allow super admins to view and update user_logo_settings
*/

CREATE OR REPLACE FUNCTION public.get_organizer_emails(organizer_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.id = ANY(organizer_ids)
    AND EXISTS (
      SELECT 1 FROM super_admins sa
      WHERE sa.user_id = auth.uid()
    );
$$;

DROP POLICY IF EXISTS "Super admins can view all user_logo_settings" ON user_logo_settings;
CREATE POLICY "Super admins can view all user_logo_settings"
  ON user_logo_settings
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can update all user_logo_settings" ON user_logo_settings;
CREATE POLICY "Super admins can update all user_logo_settings"
  ON user_logo_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
