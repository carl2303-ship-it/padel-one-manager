/*
  # Add booking slot duration and max advance days settings

  Adds to user_logo_settings:
  - booking_slot_duration (integer, default 90) - slot duration in minutes (60, 90, 120)
  - max_advance_days (integer, default 7) - how many days ahead bookings/games are allowed
*/

ALTER TABLE user_logo_settings
ADD COLUMN IF NOT EXISTS booking_slot_duration integer DEFAULT 90,
ADD COLUMN IF NOT EXISTS max_advance_days integer DEFAULT 7;
