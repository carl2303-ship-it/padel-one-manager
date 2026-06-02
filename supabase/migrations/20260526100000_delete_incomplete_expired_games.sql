-- ==========================================================================
-- Update cleanup_expired_open_games to also DELETE expired games
-- that never reached 4 confirmed players (incomplete games).
-- These games are useless for results and should be removed.
-- ==========================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_open_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER := 0;
  expired_ids uuid[];
  incomplete_ids uuid[];
BEGIN
  -- 1. Find games that have ended but are still open/full
  SELECT array_agg(id)
  INTO expired_ids
  FROM open_games
  WHERE status IN ('open', 'full')
    AND (scheduled_at + (duration_minutes || ' minutes')::interval) < now();

  IF expired_ids IS NOT NULL AND array_length(expired_ids, 1) > 0 THEN
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
  END IF;

  -- 2. Delete expired games with < 4 confirmed players (incomplete, no valid game)
  SELECT array_agg(og.id)
  INTO incomplete_ids
  FROM open_games og
  WHERE og.status = 'expired'
    AND NOT EXISTS (
      SELECT 1 FROM open_game_results ogr WHERE ogr.game_id = og.id
    )
    AND (
      SELECT count(*)
      FROM open_game_players ogp
      WHERE ogp.game_id = og.id AND ogp.status = 'confirmed'
    ) < 4;

  IF incomplete_ids IS NOT NULL AND array_length(incomplete_ids, 1) > 0 THEN
    -- open_game_players has ON DELETE CASCADE, so they are cleaned automatically
    DELETE FROM open_games WHERE id = ANY(incomplete_ids);
    affected := affected + array_length(incomplete_ids, 1);
    RAISE LOG 'cleanup_expired_open_games: deleted % incomplete expired games', array_length(incomplete_ids, 1);
  END IF;

  RETURN affected;
END;
$$;
