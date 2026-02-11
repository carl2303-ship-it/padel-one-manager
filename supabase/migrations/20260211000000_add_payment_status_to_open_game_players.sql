/*
  # Add payment status to open game players

  Adds payment_status column to track if each player has paid for the game.
*/

ALTER TABLE open_game_players
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid'));

-- Add index for querying payment status
CREATE INDEX IF NOT EXISTS idx_open_game_players_payment_status ON open_game_players(payment_status);
