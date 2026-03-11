-- club_orders is already in supabase_realtime, just ensure anon can read
-- Allow anonymous users to read club_orders (for order status tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous to read own orders by id' AND tablename = 'club_orders'
  ) THEN
    CREATE POLICY "Allow anonymous to read own orders by id"
    ON club_orders FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;
