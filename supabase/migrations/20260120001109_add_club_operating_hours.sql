/*
  # Add Club Operating Hours

  1. Changes
    - Add booking_start_time and booking_end_time to user_logo_settings
    - These define when court bookings can be made
    - Default to 08:00 - 22:00

  2. Notes
    - Times stored as text in HH:MM format
    - Used to generate available time slots in booking form
*/

ALTER TABLE user_logo_settings
ADD COLUMN IF NOT EXISTS booking_start_time text DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS booking_end_time text DEFAULT '22:00';