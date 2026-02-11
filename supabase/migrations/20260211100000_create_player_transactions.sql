-- Create player_transactions table to track individual spending
-- This replaces the problematic approach of using court_bookings fields

CREATE TABLE IF NOT EXISTS player_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_account_id uuid REFERENCES player_accounts(id) ON DELETE SET NULL,
  player_name text NOT NULL,
  player_phone text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('booking', 'open_game', 'academy', 'bar')),
  amount decimal(10,2) NOT NULL,
  reference_id uuid, -- ID of the booking, open_game, class, or order
  reference_type text, -- 'court_booking', 'open_game', 'class_booking', 'bar_order'
  transaction_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE player_transactions ENABLE ROW LEVEL SECURITY;

-- Club owners can manage their transactions
CREATE POLICY "Club owners can manage transactions"
  ON player_transactions
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

-- Players can view their own transactions
CREATE POLICY "Players can view their own transactions"
  ON player_transactions
  FOR SELECT
  TO authenticated
  USING (
    player_account_id IN (
      SELECT id FROM player_accounts WHERE user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_transactions_club_owner ON player_transactions(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_player_transactions_player ON player_transactions(player_account_id);
CREATE INDEX IF NOT EXISTS idx_player_transactions_date ON player_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_player_transactions_type ON player_transactions(transaction_type);
