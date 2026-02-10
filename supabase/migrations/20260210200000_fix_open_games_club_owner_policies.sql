/*
  # Fix Open Games RLS - Allow club owners to manage games at their clubs
  
  Club owners need to be able to:
  - View all games at their club (already exists)
  - Cancel/update games at their club
  - Update game player statuses at their club

  Also adds a policy for court_bookings to allow the open_game sync 
  (when a player creates a booking on behalf of the club owner).
*/

-- Allow club owners to update games at their club (cancel, etc.)
DROP POLICY IF EXISTS "Club owners can update games at their club" ON open_games;
CREATE POLICY "Club owners can update games at their club"
  ON open_games FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs WHERE clubs.id = open_games.club_id AND clubs.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clubs WHERE clubs.id = open_games.club_id AND clubs.owner_id = auth.uid()
    )
  );

-- Allow club owners to update game players at their club (accept/reject requests)
DROP POLICY IF EXISTS "Club owners can update game players at their club" ON open_game_players;
CREATE POLICY "Club owners can update game players at their club"
  ON open_game_players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM open_games 
      JOIN clubs ON clubs.id = open_games.club_id 
      WHERE open_games.id = open_game_players.game_id AND clubs.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM open_games 
      JOIN clubs ON clubs.id = open_games.club_id 
      WHERE open_games.id = open_game_players.game_id AND clubs.owner_id = auth.uid()
    )
  );

-- Allow authenticated users to insert court_bookings (needed for open game sync from Player app)
-- The Player app inserts a booking with user_id = club.owner_id for sync
DROP POLICY IF EXISTS "Authenticated can insert court bookings for open games" ON court_bookings;
CREATE POLICY "Authenticated can insert court bookings for open games"
  ON court_bookings FOR INSERT
  TO authenticated
  WITH CHECK (event_type = 'open_game');
