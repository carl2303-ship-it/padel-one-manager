/*
  # Automatic Tournament Court Bookings

  1. Overview
    - Creates automatic court bookings when tournaments are linked to clubs
    - Books all specified courts for the tournament duration
    - Displays tournament name instead of individual matches

  2. New Functions
    - `create_tournament_court_bookings()`: Creates bookings for a tournament
    - `cleanup_tournament_court_bookings()`: Removes old bookings when tournament is updated

  3. Triggers
    - Automatically creates bookings when tournament club_id is set
    - Updates bookings when tournament dates/times change
    - Removes bookings when club_id is removed

  4. Behavior
    - Books entire tournament period (start_date to end_date)
    - Uses tournament start_time and end_time for each day
    - Matches court names from tournament.court_names to club_courts
    - Creates bookings with event_type = 'tournament'
    - Links bookings to tournament via booking_name
*/

-- Function to cleanup old tournament bookings
CREATE OR REPLACE FUNCTION cleanup_tournament_court_bookings(tournament_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM court_bookings
  WHERE event_type = 'tournament'
  AND booking_name LIKE (
    SELECT 'Tournament: ' || name FROM tournaments WHERE id = tournament_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create tournament court bookings
CREATE OR REPLACE FUNCTION create_tournament_court_bookings()
RETURNS trigger AS $$
DECLARE
  court_record RECORD;
  day_date date;
  booking_start timestamptz;
  booking_end timestamptz;
  court_name_to_match text;
BEGIN
  -- Only proceed if tournament has club_id
  IF NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cleanup old bookings
  PERFORM cleanup_tournament_court_bookings(NEW.id);

  -- Loop through each court name in the tournament
  IF NEW.court_names IS NOT NULL THEN
    FOREACH court_name_to_match IN ARRAY NEW.court_names
    LOOP
      -- Find matching club court
      FOR court_record IN
        SELECT id, name, user_id
        FROM club_courts
        WHERE user_id = (SELECT owner_id FROM clubs WHERE id = NEW.club_id)
        AND is_active = true
        AND (
          name = court_name_to_match
          OR name LIKE '%' || court_name_to_match || '%'
          OR court_name_to_match LIKE '%' || name || '%'
        )
      LOOP
        -- Loop through each day of the tournament
        day_date := NEW.start_date;
        WHILE day_date <= NEW.end_date LOOP
          -- Create booking for this court and day
          booking_start := (day_date || ' ' || COALESCE(NEW.start_time, '08:00'))::timestamptz;
          booking_end := (day_date || ' ' || COALESCE(NEW.end_time, '22:00'))::timestamptz;

          INSERT INTO court_bookings (
            court_id,
            start_time,
            end_time,
            booking_name,
            status,
            event_type
          ) VALUES (
            court_record.id,
            booking_start,
            booking_end,
            'Tournament: ' || NEW.name,
            'confirmed',
            'tournament'
          );

          day_date := day_date + 1;
        END LOOP;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create bookings on tournament insert/update
DROP TRIGGER IF EXISTS auto_create_tournament_bookings ON tournaments;
CREATE TRIGGER auto_create_tournament_bookings
  AFTER INSERT OR UPDATE OF club_id, start_date, end_date, start_time, end_time, court_names, name
  ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION create_tournament_court_bookings();

-- Trigger to cleanup bookings when tournament is deleted
CREATE OR REPLACE FUNCTION cleanup_tournament_bookings_on_delete()
RETURNS trigger AS $$
BEGIN
  PERFORM cleanup_tournament_court_bookings(OLD.id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS cleanup_tournament_bookings ON tournaments;
CREATE TRIGGER cleanup_tournament_bookings
  BEFORE DELETE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_tournament_bookings_on_delete();