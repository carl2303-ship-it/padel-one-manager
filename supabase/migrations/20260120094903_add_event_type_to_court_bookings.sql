/*
  # Add event type to court bookings

  1. Changes
    - Add event_type column to court_bookings table
    - Allows bookings to be categorized (match, tournament, training, event, etc.)
  
  2. Details
    - event_type: text field with check constraint
    - Default value is 'match' for regular bookings
    - Options: 'match', 'tournament', 'training', 'event', 'maintenance'
    - When event_type is not 'match', player names are optional
*/

ALTER TABLE court_bookings 
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'match' 
  CHECK (event_type IN ('match', 'tournament', 'training', 'event', 'maintenance'));