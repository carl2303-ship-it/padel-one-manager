/*
  # Add timezone to clubs

  Adds a `timezone` column to the `clubs` table so each club can define
  its own IANA timezone (e.g. 'Europe/Lisbon', 'America/Mexico_City').
  All existing clubs default to 'Europe/Lisbon'.
*/

ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Lisbon';
