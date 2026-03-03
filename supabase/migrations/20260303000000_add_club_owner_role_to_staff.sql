/*
  # Add club_owner role to club_staff

  1. Changes
    - Update the CHECK constraint on club_staff.role to include 'club_owner'
    - This allows creating staff members with the Club Owner role
  
  2. Details
    - The role field now accepts: 'admin', 'bar_staff', 'coach', 'receptionist', 'club_owner', 'other'
*/

-- Drop the existing CHECK constraint
ALTER TABLE club_staff
  DROP CONSTRAINT IF EXISTS club_staff_role_check;

-- Add the new CHECK constraint with club_owner included
ALTER TABLE club_staff
  ADD CONSTRAINT club_staff_role_check 
  CHECK (role IN ('admin', 'bar_staff', 'coach', 'receptionist', 'club_owner', 'other'));
