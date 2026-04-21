/*
  # Use club timezone in tournament booking trigger

  Instead of hardcoding 'Europe/Lisbon', read the timezone from the
  clubs table so tournaments in other countries convert correctly.
*/

CREATE OR REPLACE FUNCTION create_tournament_court_bookings()
RETURNS trigger AS $$
DECLARE
  court_record RECORD;
  day_date date;
  booking_start timestamptz;
  booking_end timestamptz;
  court_name_to_match text;
  club_tz text;
BEGIN
  IF NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(timezone, 'Europe/Lisbon') INTO club_tz
  FROM clubs WHERE id = NEW.club_id;

  PERFORM cleanup_tournament_court_bookings(NEW.id);

  IF NEW.court_names IS NOT NULL THEN
    FOREACH court_name_to_match IN ARRAY NEW.court_names
    LOOP
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
        day_date := NEW.start_date;
        WHILE day_date <= NEW.end_date LOOP
          booking_start := (day_date || ' ' || COALESCE(NEW.start_time, '08:00'))::timestamp AT TIME ZONE club_tz;
          booking_end := (day_date || ' ' || COALESCE(NEW.end_time, '22:00'))::timestamp AT TIME ZONE club_tz;

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
