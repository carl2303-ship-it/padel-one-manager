/*
  # Fix Tournament Booking Timezone

  The trigger was casting '2026-04-10 19:30'::timestamptz which Postgres (in UTC)
  interprets as 19:30 UTC. But tournament start_time/end_time are meant as
  Portuguese local time. This caused bookings to appear 1h later in the Manager app.

  Fix: use ::timestamp AT TIME ZONE 'Europe/Lisbon' so Postgres correctly converts
  Portuguese local time to UTC for storage.
*/

CREATE OR REPLACE FUNCTION create_tournament_court_bookings()
RETURNS trigger AS $$
DECLARE
  court_record RECORD;
  day_date date;
  booking_start timestamptz;
  booking_end timestamptz;
  court_name_to_match text;
BEGIN
  IF NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

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
          booking_start := (day_date || ' ' || COALESCE(NEW.start_time, '08:00'))::timestamp AT TIME ZONE 'Europe/Lisbon';
          booking_end := (day_date || ' ' || COALESCE(NEW.end_time, '22:00'))::timestamp AT TIME ZONE 'Europe/Lisbon';

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
