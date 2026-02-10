/*
  # Auto-link Tournaments to Club by User ID
  
  Since organizers use the same email for both apps, we can automatically 
  link tournaments to their club without manual selection.
  
  1. Changes
    - Create trigger to auto-set club_id when tournament is created/updated
    - Update existing tournaments to link to their owner's club
    
  2. Logic
    - When a tournament is created, find the club owned by the same user
    - Automatically set the club_id to that club
*/

-- Function to auto-link tournament to club
CREATE OR REPLACE FUNCTION auto_link_tournament_to_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.club_id IS NULL THEN
    SELECT id INTO v_club_id
    FROM clubs
    WHERE owner_id = NEW.user_id
    LIMIT 1;
    
    IF v_club_id IS NOT NULL THEN
      NEW.club_id := v_club_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-linking tournaments
DROP TRIGGER IF EXISTS trigger_auto_link_tournament_to_club ON tournaments;
CREATE TRIGGER trigger_auto_link_tournament_to_club
  BEFORE INSERT OR UPDATE OF user_id ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_tournament_to_club();

-- Update existing tournaments to link to their owner's club
UPDATE tournaments t
SET club_id = c.id
FROM clubs c
WHERE t.user_id = c.owner_id
AND t.club_id IS NULL;

-- Also auto-link leagues to clubs
CREATE OR REPLACE FUNCTION auto_link_league_to_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.club_id IS NULL THEN
    SELECT id INTO v_club_id
    FROM clubs
    WHERE owner_id = NEW.user_id
    LIMIT 1;
    
    IF v_club_id IS NOT NULL THEN
      NEW.club_id := v_club_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_link_league_to_club ON leagues;
CREATE TRIGGER trigger_auto_link_league_to_club
  BEFORE INSERT OR UPDATE OF user_id ON leagues
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_league_to_club();

-- Update existing leagues to link to their owner's club
UPDATE leagues l
SET club_id = c.id
FROM clubs c
WHERE l.user_id = c.owner_id
AND l.club_id IS NULL;
