/*
  # Staff Management System

  This migration creates the staff management table for club personnel.

  ## 1. New Table

  ### club_staff
  - `id` (uuid, primary key) - Unique identifier
  - `club_owner_id` (uuid) - Owner of the club who manages this staff
  - `user_id` (uuid, nullable) - Auth user ID if staff has login access
  - `name` (text) - Staff member name
  - `email` (text, nullable) - Staff email
  - `phone` (text, nullable) - Staff phone number
  - `role` (text) - Staff role: admin, bar_staff, coach, receptionist, other
  - `permissions` (jsonb) - Specific permissions for the staff member
  - `is_active` (boolean) - Whether staff member is active
  - `notes` (text, nullable) - Additional notes
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Security
  - RLS enabled
  - Only club owners can manage their staff
*/

CREATE TABLE IF NOT EXISTS club_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'other' CHECK (role IN ('admin', 'bar_staff', 'coach', 'receptionist', 'other')),
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE club_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their staff"
  ON club_staff
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_club_staff_club_owner_id ON club_staff(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_club_staff_user_id ON club_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_club_staff_role ON club_staff(role);
CREATE INDEX IF NOT EXISTS idx_club_staff_is_active ON club_staff(is_active);
