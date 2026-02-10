-- Allow game creators to add players to their games
-- The existing policy only allows user_id = auth.uid()
-- We need to also allow game creators to insert other players

DROP POLICY IF EXISTS "Players can join games" ON open_game_players;

CREATE POLICY "Players can join games"
  ON open_game_players FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Player can add themselves
    user_id = auth.uid()
    -- OR the game creator can add any player
    OR EXISTS (
      SELECT 1 FROM open_games 
      WHERE open_games.id = open_game_players.game_id 
      AND open_games.creator_user_id = auth.uid()
    )
  );
