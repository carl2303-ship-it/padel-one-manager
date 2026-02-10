/*
  # Add open_game event type to court_bookings

  Allows open games created from the Player app to be stored as court bookings
  visible in the Manager app's calendar.
*/

-- Drop the old check constraint and recreate with open_game included
ALTER TABLE court_bookings DROP CONSTRAINT IF EXISTS court_bookings_event_type_check;
ALTER TABLE court_bookings ADD CONSTRAINT court_bookings_event_type_check 
  CHECK (event_type IN ('match', 'tournament', 'training', 'event', 'maintenance', 'open_game'));
