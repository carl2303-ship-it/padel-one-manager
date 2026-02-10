/*
  # Create Open Games (Encontrar Jogo) System
  
  Allows players to create and join open padel games.
  
  ## Tables
  
  ### open_games
  - Created by a player
  - Linked to a club (and optionally a court)
  - Has scheduled time, duration, game type, gender, level range, price
  - Status: open (looking for players), full (4 players), cancelled, completed
  
  ### open_game_players
  - Players in or requesting to join a game
  - Status: confirmed (auto when within level range), pending (out of level range - needs approval), rejected
  - Position 1 = creator
  
  ## RLS
  - Anyone authenticated can view open games
  - Creator can manage their own game
  - Players can join / leave games
  - Club owners can see games at their club
*/

-- ============================
-- Open Games table
-- ============================
CREATE TABLE IF NOT EXISTS open_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES auth.users(id),
  club_id uuid NOT NULL REFERENCES clubs(id),
  court_id uuid REFERENCES club_courts(id),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 90 CHECK (duration_minutes IN (60, 90, 120)),
  game_type text NOT NULL DEFAULT 'friendly' CHECK (game_type IN ('competitive', 'friendly')),
  gender text NOT NULL DEFAULT 'all' CHECK (gender IN ('all', 'male', 'female', 'mixed')),
  level_min numeric(3,1) DEFAULT 1.0,
  level_max numeric(3,1) DEFAULT 7.0,
  price_per_player decimal(10,2) DEFAULT 0,
  max_players integer NOT NULL DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 8),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE open_games ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view open/full games
CREATE POLICY "Anyone can view open games"
  ON open_games FOR SELECT
  TO authenticated
  USING (status IN ('open', 'full'));

-- Creator can do anything with their games
CREATE POLICY "Creator can manage own games"
  ON open_games FOR ALL
  TO authenticated
  USING (creator_user_id = auth.uid())
  WITH CHECK (creator_user_id = auth.uid());

-- Club owners can see games at their club
CREATE POLICY "Club owners can view games at their club"
  ON open_games FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs WHERE clubs.id = open_games.club_id AND clubs.owner_id = auth.uid()
    )
  );

-- Anyone authenticated can create a game
CREATE POLICY "Anyone can create open games"
  ON open_games FOR INSERT
  TO authenticated
  WITH CHECK (creator_user_id = auth.uid());

-- ============================
-- Open Game Players table
-- ============================
CREATE TABLE IF NOT EXISTS open_game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES open_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  player_account_id uuid,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'rejected')),
  position integer CHECK (position >= 1 AND position <= 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id)
);

ALTER TABLE open_game_players ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view players of open games
CREATE POLICY "Anyone can view game players"
  ON open_game_players FOR SELECT
  TO authenticated
  USING (true);

-- Players can join (insert themselves)
CREATE POLICY "Players can join games"
  ON open_game_players FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Players can leave (delete themselves) or creator can manage
CREATE POLICY "Players can leave games"
  ON open_game_players FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM open_games WHERE open_games.id = open_game_players.game_id AND open_games.creator_user_id = auth.uid()
    )
  );

-- Creator of the game can update player status (accept/reject requests)
CREATE POLICY "Creator can update game players"
  ON open_game_players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM open_games WHERE open_games.id = open_game_players.game_id AND open_games.creator_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM open_games WHERE open_games.id = open_game_players.game_id AND open_games.creator_user_id = auth.uid()
    )
  );

-- ============================
-- Allow authenticated users to view active clubs (needed for Player app)
-- ============================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clubs' AND policyname = 'Authenticated can view active clubs'
  ) THEN
    CREATE POLICY "Authenticated can view active clubs"
      ON clubs FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- Allow authenticated users to view active club courts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'club_courts' AND policyname = 'Authenticated can view all active courts'
  ) THEN
    CREATE POLICY "Authenticated can view all active courts"
      ON club_courts FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

-- Allow authenticated to view court bookings (to check availability)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'court_bookings' AND policyname = 'Authenticated can view bookings for availability'
  ) THEN
    CREATE POLICY "Authenticated can view bookings for availability"
      ON court_bookings FOR SELECT
      TO authenticated
      USING (status = 'confirmed');
  END IF;
END $$;

-- Allow authenticated to read user_logo_settings (for operating hours)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_logo_settings' AND policyname = 'Authenticated can read club settings'
  ) THEN
    CREATE POLICY "Authenticated can read club settings"
      ON user_logo_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_open_games_club_id ON open_games(club_id);
CREATE INDEX IF NOT EXISTS idx_open_games_status ON open_games(status);
CREATE INDEX IF NOT EXISTS idx_open_games_scheduled_at ON open_games(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_open_games_creator ON open_games(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_open_game_players_game_id ON open_game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_open_game_players_user_id ON open_game_players(user_id);
