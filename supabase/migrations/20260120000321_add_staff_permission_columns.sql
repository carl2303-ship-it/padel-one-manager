/*
  # Add Staff Permission Columns

  1. Changes
    - Add individual permission columns to club_staff table for cleaner permission checking
    - perm_bookings: Can manage court bookings
    - perm_members: Can manage members
    - perm_bar: Can manage bar/restaurant
    - perm_academy: Can manage academy/classes
    - perm_reports: Can view financial reports

  2. Notes
    - Admins get all permissions by default
    - Each permission controls access to a specific section of the dashboard
*/

ALTER TABLE club_staff
ADD COLUMN IF NOT EXISTS perm_bookings boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS perm_members boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS perm_bar boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS perm_academy boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS perm_reports boolean DEFAULT false;

UPDATE club_staff
SET perm_bookings = true,
    perm_members = true,
    perm_bar = true,
    perm_academy = true,
    perm_reports = true
WHERE role = 'admin';

UPDATE club_staff
SET perm_bar = true
WHERE role = 'bar_staff';

UPDATE club_staff
SET perm_academy = true
WHERE role = 'coach';

UPDATE club_staff
SET perm_bookings = true,
    perm_members = true
WHERE role = 'receptionist';