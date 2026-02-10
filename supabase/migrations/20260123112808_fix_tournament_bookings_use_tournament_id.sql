/*
  # Fix Tournament Bookings to use tournament_id

  1. Changes
    - Update cleanup function to use tournament_id instead of booking_name
    - Update create function to set tournament_id directly
    - Simpler and more efficient approach
*/

-- Drop old function first
DROP FUNCTION IF EXISTS cleanup_tournament_court_bookings(uuid);

-- Function to cleanup old tournament bookings
CREATE OR REPLACE FUNCTION cleanup_tournament_court_bookings(p_tournament_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM court_bookings
  WHERE tournament_id = p_tournament_id;
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
            tournament_id,
            booked_by_name,
            status,
            event_type
          ) VALUES (
            court_record.id,
            booking_start,
            booking_end,
            NEW.id,
            NEW.name,
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