/*
  # Add available booking slots

  Adds to user_logo_settings:
  - available_booking_slots (jsonb, nullable) - array of time strings (e.g. ["08:00","08:30","09:00",...])
    representing which 30-min time slots are available for booking.
    When null/empty, all slots between booking_start_time and booking_end_time are available.
*/

ALTER TABLE user_logo_settings
ADD COLUMN IF NOT EXISTS available_booking_slots jsonb DEFAULT NULL;
