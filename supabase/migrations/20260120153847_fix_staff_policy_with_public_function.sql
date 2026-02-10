/*
  # Fix Staff Policy - Use Public Function for Auth Email

  1. Problem
    - Cannot create functions in auth schema
    - Policy using SELECT from auth.users is denied

  2. Solution
    - Create function in public schema to get current user email
    - Update policy to use the function
*/

-- Create function in public schema to get current user email
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_auth_email() TO authenticated;

-- Drop and recreate the policy using the function
DROP POLICY IF EXISTS "Staff can view own record by email" ON club_staff;

CREATE POLICY "Staff can view own record by email"
  ON club_staff
  FOR SELECT
  TO authenticated
  USING (email = public.get_auth_email());
