/*
  # Create Super Admin System

  1. New Tables
    - `super_admins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - the authenticated user
      - `name` (text) - admin name
      - `created_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `subscription_status` to track if organizer is paying
    - Add `subscription_expires_at` for subscription expiry
    - Add `is_active` to enable/disable organizers

  3. Security
    - Only super admins can view/manage other users
    - RLS policies to protect super admin data

  4. Important Notes
    - Super admins have app-level access to manage all organizers
    - This is separate from club ownership
*/

-- Create super_admins table
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view their own record
CREATE POLICY "Super admins can view own record"
  ON super_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create organizers table to track all app users (club owners)
CREATE TABLE IF NOT EXISTS organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  email text NOT NULL,
  name text,
  club_name text,
  phone text,
  subscription_status text DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled')),
  subscription_plan text DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'pro', 'enterprise')),
  subscription_expires_at timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;

-- Policy: Organizers can view their own record
CREATE POLICY "Organizers can view own record"
  ON organizers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Super admins can view all organizers
CREATE POLICY "Super admins can view all organizers"
  ON organizers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- Policy: Super admins can update all organizers
CREATE POLICY "Super admins can update all organizers"
  ON organizers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- Policy: Super admins can insert organizers
CREATE POLICY "Super admins can insert organizers"
  ON organizers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- Policy: Super admins can delete organizers
CREATE POLICY "Super admins can delete organizers"
  ON organizers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_super_admins_user_id ON super_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_organizers_user_id ON organizers(user_id);
CREATE INDEX IF NOT EXISTS idx_organizers_subscription_status ON organizers(subscription_status);

-- Function to check if user is super admin
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
