-- Player Level History: tracks every level change for evolution charts
CREATE TABLE IF NOT EXISTS player_level_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_account_id uuid NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
  level_before numeric(4,2) NOT NULL,
  level_after numeric(4,2) NOT NULL,
  delta numeric(5,4) NOT NULL,
  match_type text NOT NULL DEFAULT 'tournament', -- 'tournament' | 'open_game'
  match_won boolean,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_plh_player ON player_level_history(player_account_id);
CREATE INDEX idx_plh_player_date ON player_level_history(player_account_id, created_at DESC);

ALTER TABLE player_level_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read own level history"
  ON player_level_history FOR SELECT
  USING (
    player_account_id IN (
      SELECT id FROM player_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert level history"
  ON player_level_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon can insert level history"
  ON player_level_history FOR INSERT TO anon
  WITH CHECK (true);
