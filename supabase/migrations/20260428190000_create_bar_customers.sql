-- Bar Customers: separate from player_accounts for bar-only clients
CREATE TABLE IF NOT EXISTS bar_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  phone_number text,
  email text,
  notes text,
  total_spent numeric(10,2) DEFAULT 0,
  visit_count int DEFAULT 1,
  last_visit_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bar_customers_club_phone_idx
  ON bar_customers (club_owner_id, phone_number)
  WHERE phone_number IS NOT NULL;

ALTER TABLE bar_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their bar customers"
  ON bar_customers FOR ALL TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

-- Add bar_customer_id to bar_tabs
ALTER TABLE bar_tabs ADD COLUMN IF NOT EXISTS bar_customer_id uuid REFERENCES bar_customers(id);
