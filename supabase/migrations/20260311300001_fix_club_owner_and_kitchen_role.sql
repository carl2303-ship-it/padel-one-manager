-- Fix: previous migration removed 'club_owner' from allowed roles,
-- causing all club_owner staff to be changed to 'other'.
-- This migration restores club_owner and adds kitchen.

-- 1. Drop the current constraint
ALTER TABLE club_staff DROP CONSTRAINT IF EXISTS club_staff_role_check;

-- 2. Add corrected constraint with BOTH club_owner and kitchen
ALTER TABLE club_staff ADD CONSTRAINT club_staff_role_check
  CHECK (role IN ('admin', 'bar_staff', 'coach', 'receptionist', 'kitchen', 'club_owner', 'other'));

-- 3. Restore club_owner for staff members that were incorrectly changed to 'other'
-- The club owner is the one whose user_id matches the club's owner_id
UPDATE club_staff cs
SET role = 'club_owner'
FROM clubs c
WHERE cs.club_owner_id = c.owner_id
  AND cs.user_id = c.owner_id
  AND cs.role = 'other';
