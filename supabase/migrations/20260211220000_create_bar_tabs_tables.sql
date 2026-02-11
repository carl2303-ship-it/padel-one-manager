-- Create bar_tabs table for open running accounts (contas abertas)
-- Tournament players and walk-ins can have a tab opened for them
-- The bartender can add menu items to the tab and close/pay it

CREATE TABLE IF NOT EXISTS bar_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  player_phone text,
  player_account_id uuid REFERENCES player_accounts(id) ON DELETE SET NULL,
  tournament_id uuid,
  tournament_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  total decimal(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bar_tabs ENABLE ROW LEVEL SECURITY;

-- Club owners can manage their tabs
CREATE POLICY "Club owners can manage bar tabs"
  ON bar_tabs
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

-- Staff can manage bar tabs
CREATE POLICY "Staff can manage bar tabs"
  ON bar_tabs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = bar_tabs.club_owner_id
      AND club_staff.perm_bar = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = bar_tabs.club_owner_id
      AND club_staff.perm_bar = true
    )
  );

-- Create bar_tab_items table for items added to a tab
CREATE TABLE IF NOT EXISTS bar_tab_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES bar_tabs(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL DEFAULT 0,
  total_price decimal(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bar_tab_items ENABLE ROW LEVEL SECURITY;

-- Club owners can manage tab items
CREATE POLICY "Club owners can manage bar tab items"
  ON bar_tab_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bar_tabs
      WHERE bar_tabs.id = bar_tab_items.tab_id
      AND bar_tabs.club_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bar_tabs
      WHERE bar_tabs.id = bar_tab_items.tab_id
      AND bar_tabs.club_owner_id = auth.uid()
    )
  );

-- Staff can manage tab items
CREATE POLICY "Staff can manage bar tab items"
  ON bar_tab_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bar_tabs
      JOIN club_staff ON club_staff.club_owner_id = bar_tabs.club_owner_id
      WHERE bar_tabs.id = bar_tab_items.tab_id
      AND club_staff.user_id = auth.uid()
      AND club_staff.perm_bar = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bar_tabs
      JOIN club_staff ON club_staff.club_owner_id = bar_tabs.club_owner_id
      WHERE bar_tabs.id = bar_tab_items.tab_id
      AND club_staff.user_id = auth.uid()
      AND club_staff.perm_bar = true
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bar_tabs_club_owner ON bar_tabs(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_bar_tabs_status ON bar_tabs(status);
CREATE INDEX IF NOT EXISTS idx_bar_tabs_tournament ON bar_tabs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_bar_tab_items_tab ON bar_tab_items(tab_id);

-- Add 'bar_tab' to the transaction_type check constraint on player_transactions
-- (the existing 'bar' type will be used for bar tab payments)
