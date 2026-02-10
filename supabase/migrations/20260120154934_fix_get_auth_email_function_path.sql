/*
  # Fix get_auth_email function search path

  1. Problem
    - Function has empty search_path which prevents finding auth.uid()
    
  2. Solution
    - Recreate function with proper search_path including auth schema
*/

-- Recreate function with proper search path
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;
