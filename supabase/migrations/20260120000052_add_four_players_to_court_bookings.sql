/*
  # Add Four Players to Court Bookings

  1. Changes
    - Add player2_name, player3_name, player4_name columns to court_bookings
    - Rename booked_by_name to player1_name for consistency
    - Add player1_phone, player2_phone, player3_phone, player4_phone for member lookup
    - Add player1_is_member, player2_is_member, player3_is_member, player4_is_member flags
    - Add player1_discount, player2_discount, player3_discount, player4_discount for per-player discounts

  2. Notes
    - Player 1 is the main booker (required)
    - Players 2-4 are optional
    - Each player can be a member with their own discount applied to 1/4 of the total price
*/

ALTER TABLE court_bookings
ADD COLUMN IF NOT EXISTS player1_name text,
ADD COLUMN IF NOT EXISTS player2_name text,
ADD COLUMN IF NOT EXISTS player3_name text,
ADD COLUMN IF NOT EXISTS player4_name text,
ADD COLUMN IF NOT EXISTS player1_phone text,
ADD COLUMN IF NOT EXISTS player2_phone text,
ADD COLUMN IF NOT EXISTS player3_phone text,
ADD COLUMN IF NOT EXISTS player4_phone text,
ADD COLUMN IF NOT EXISTS player1_is_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS player2_is_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS player3_is_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS player4_is_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS player1_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS player2_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS player3_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS player4_discount numeric DEFAULT 0;

UPDATE court_bookings
SET player1_name = booked_by_name,
    player1_phone = booked_by_phone
WHERE player1_name IS NULL AND booked_by_name IS NOT NULL;