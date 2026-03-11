-- Force update club_staff role constraint to include 'kitchen'

-- Drop ALL check constraints on role column first
ALTER TABLE club_staff DROP CONSTRAINT IF EXISTS club_staff_role_check;
ALTER TABLE club_staff DROP CONSTRAINT IF EXISTS club_staff_role_check1;
ALTER TABLE club_staff DROP CONSTRAINT IF EXISTS club_staff_check;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.club_staff'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE club_staff DROP CONSTRAINT ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- Fix any existing rows with roles not in the new allowed list
UPDATE club_staff
SET role = 'other'
WHERE role NOT IN ('admin', 'bar_staff', 'coach', 'receptionist', 'kitchen', 'other');

-- Now add the correct constraint with kitchen role
ALTER TABLE club_staff ADD CONSTRAINT club_staff_role_check
  CHECK (role IN ('admin', 'bar_staff', 'coach', 'receptionist', 'kitchen', 'other'));
