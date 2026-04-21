-- Enable realtime on court_bookings, open_games and open_game_players
-- so Manager auto-refreshes when players create/cancel bookings or join games

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE court_bookings;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE open_games;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE open_game_players;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
