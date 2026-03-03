/*
  # Sync club_staff with role='coach' to club_coaches table

  1. Changes
    - Create a function that syncs staff members with role='coach' to club_coaches
    - Create a trigger that runs when staff member accepts invite (user_id is set)
    - Also sync when staff role is changed to 'coach'
  
  2. Details
    - When a staff member with role='coach' gets a user_id (accepts invite), create/update in club_coaches
    - When a staff member's role is changed to 'coach' and has user_id, create in club_coaches
    - When a staff member's role is changed from 'coach' to something else, mark coach as inactive
*/

-- Create unique constraint on (user_id, club_owner_id) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'club_coaches_user_club_unique'
  ) THEN
    ALTER TABLE club_coaches
    ADD CONSTRAINT club_coaches_user_club_unique 
    UNIQUE (user_id, club_owner_id);
  END IF;
END $$;

-- Function to sync coach from club_staff to club_coaches
CREATE OR REPLACE FUNCTION sync_staff_coach_to_club_coaches()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is 'coach' and user_id is set, sync to club_coaches
  IF NEW.role = 'coach' AND NEW.user_id IS NOT NULL THEN
    -- Check if coach already exists
    INSERT INTO club_coaches (
      user_id,
      club_owner_id,
      name,
      email,
      phone,
      is_active
    )
    VALUES (
      NEW.user_id,
      NEW.club_owner_id,
      NEW.name,
      NEW.email,
      NEW.phone,
      NEW.is_active
    )
    ON CONFLICT (user_id, club_owner_id) 
    DO UPDATE SET
      name = NEW.name,
      email = NEW.email,
      phone = NEW.phone,
      is_active = NEW.is_active;
  END IF;
  
  -- If role changed from 'coach' to something else, mark coach as inactive
  IF OLD.role = 'coach' AND NEW.role != 'coach' AND NEW.user_id IS NOT NULL THEN
    UPDATE club_coaches
    SET is_active = false
    WHERE user_id = NEW.user_id
      AND club_owner_id = NEW.club_owner_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on club_staff update
DROP TRIGGER IF EXISTS sync_staff_coach_trigger ON club_staff;
CREATE TRIGGER sync_staff_coach_trigger
  AFTER INSERT OR UPDATE ON club_staff
  FOR EACH ROW
  EXECUTE FUNCTION sync_staff_coach_to_club_coaches();

-- Also sync existing coaches that have user_id
INSERT INTO club_coaches (
  user_id,
  club_owner_id,
  name,
  email,
  phone,
  is_active
)
SELECT 
  cs.user_id,
  cs.club_owner_id,
  cs.name,
  cs.email,
  cs.phone,
  cs.is_active
FROM club_staff cs
WHERE cs.role = 'coach'
  AND cs.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM club_coaches cc
    WHERE cc.user_id = cs.user_id
      AND cc.club_owner_id = cs.club_owner_id
  )
ON CONFLICT (user_id, club_owner_id) DO NOTHING;
