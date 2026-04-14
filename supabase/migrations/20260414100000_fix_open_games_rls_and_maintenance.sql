-- ==========================================================================
-- Fix open_games RLS: allow club owners to DELETE + see all game statuses
-- ==========================================================================

-- 1. Club owners can DELETE games at their club
DROP POLICY IF EXISTS "Club owners can delete games at their club" ON open_games;
CREATE POLICY "Club owners can delete games at their club"
  ON open_games FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs WHERE clubs.id = open_games.club_id AND clubs.owner_id = auth.uid()
    )
  );

-- 2. Club owners can delete game players at their club
DROP POLICY IF EXISTS "Club owners can delete game players at their club" ON open_game_players;
CREATE POLICY "Club owners can delete game players at their club"
  ON open_game_players FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM open_games
      JOIN clubs ON clubs.id = open_games.club_id
      WHERE open_games.id = open_game_players.game_id AND clubs.owner_id = auth.uid()
    )
  );

-- 3. Club owners can see ALL games (not just open/full) at their club
DROP POLICY IF EXISTS "Club owners can view games at their club" ON open_games;
CREATE POLICY "Club owners can view all games at their club"
  ON open_games FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs WHERE clubs.id = open_games.club_id AND clubs.owner_id = auth.uid()
    )
  );

-- 4. Staff can view all games at their club
-- club_staff uses club_owner_id (references auth.users), so we join via clubs
DROP POLICY IF EXISTS "Staff can view games at their club" ON open_games;
CREATE POLICY "Staff can view games at their club"
  ON open_games FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      JOIN club_staff ON club_staff.club_owner_id = clubs.owner_id
      WHERE clubs.id = open_games.club_id
        AND club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
    )
  );

-- 5. Staff can update games at their club
DROP POLICY IF EXISTS "Staff can update games at their club" ON open_games;
CREATE POLICY "Staff can update games at their club"
  ON open_games FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      JOIN club_staff ON club_staff.club_owner_id = clubs.owner_id
      WHERE clubs.id = open_games.club_id
        AND club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clubs
      JOIN club_staff ON club_staff.club_owner_id = clubs.owner_id
      WHERE clubs.id = open_games.club_id
        AND club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
    )
  );

-- 6. Staff can delete games at their club
DROP POLICY IF EXISTS "Staff can delete games at their club" ON open_games;
CREATE POLICY "Staff can delete games at their club"
  ON open_games FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      JOIN club_staff ON club_staff.club_owner_id = clubs.owner_id
      WHERE clubs.id = open_games.club_id
        AND club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
    )
  );

-- ==========================================================================
-- Add 'expired' to the open_games status constraint
-- ==========================================================================
ALTER TABLE open_games
  DROP CONSTRAINT IF EXISTS open_games_status_check;

ALTER TABLE open_games
  ADD CONSTRAINT open_games_status_check
  CHECK (status IN ('open', 'full', 'cancelled', 'completed', 'expired'));

-- ==========================================================================
-- SQL function: auto-expire games that passed their scheduled time
-- ==========================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_open_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER := 0;
  expired_ids uuid[];
BEGIN
  SELECT array_agg(id)
  INTO expired_ids
  FROM open_games
  WHERE status IN ('open', 'full')
    AND (scheduled_at + (duration_minutes || ' minutes')::interval) < now();

  IF expired_ids IS NULL OR array_length(expired_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE open_games
  SET status = 'expired'
  WHERE id = ANY(expired_ids);

  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE court_bookings
  SET status = 'cancelled'
  WHERE event_type = 'open_game'
    AND status = 'confirmed'
    AND EXISTS (
      SELECT 1 FROM unnest(expired_ids) AS eid
      WHERE court_bookings.notes ILIKE '%ID: ' || eid || '%'
    );

  RETURN affected;
END;
$$;

-- ==========================================================================
-- Enable pg_cron for scheduled maintenance
-- ==========================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Unschedule if exists (safe)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-open-games');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule cleanup every 15 minutes
SELECT cron.schedule(
  'cleanup-expired-open-games',
  '*/15 * * * *',
  $$SELECT cleanup_expired_open_games()$$
);

-- ==========================================================================
-- Enable pg_net for HTTP calls from cron to Edge Functions
-- ==========================================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule if exists (safe)
DO $$
BEGIN
  PERFORM cron.unschedule('alert-incomplete-open-games');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule 3-hour alert check every 30 minutes via Edge Function
SELECT cron.schedule(
  'alert-incomplete-open-games',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rqiwnxcexsccguruiteq.supabase.co/functions/v1/open-games-maintenance',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY"}'::jsonb,
    body := '{"action":"alert_incomplete"}'::jsonb
  );
  $$
);
