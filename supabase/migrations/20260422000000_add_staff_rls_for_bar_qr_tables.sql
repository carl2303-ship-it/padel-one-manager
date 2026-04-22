/*
  # Add Staff RLS Policies for QR Bar Tables

  Staff members (kitchen, bar_staff, admin) need access to club_orders,
  club_order_items, club_tables and clubs so they can view and manage
  orders from their tablet.

  Access is verified via the club_staff table (user_id, club_owner_id,
  is_active, perm_bar).
*/

-- 1. clubs: staff can read the club they belong to
CREATE POLICY "Staff can view their club"
  ON clubs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.club_owner_id = clubs.owner_id
        AND club_staff.is_active = true
    )
  );

-- 2. club_orders: staff with bar perm can view orders
CREATE POLICY "Staff can view club orders"
  ON club_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
        AND (club_staff.perm_bar = true OR club_staff.role IN ('admin', 'kitchen', 'bar_staff'))
        AND club_orders.club_id IN (
          SELECT id FROM clubs WHERE owner_id = club_staff.club_owner_id
        )
    )
  );

-- 3. club_orders: staff with bar perm can update orders (change status)
CREATE POLICY "Staff can update club orders"
  ON club_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
        AND (club_staff.perm_bar = true OR club_staff.role IN ('admin', 'kitchen', 'bar_staff'))
        AND club_orders.club_id IN (
          SELECT id FROM clubs WHERE owner_id = club_staff.club_owner_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
        AND (club_staff.perm_bar = true OR club_staff.role IN ('admin', 'kitchen', 'bar_staff'))
        AND club_orders.club_id IN (
          SELECT id FROM clubs WHERE owner_id = club_staff.club_owner_id
        )
    )
  );

-- 4. club_order_items: staff with bar perm can view order items
CREATE POLICY "Staff can view club order items"
  ON club_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      JOIN clubs ON clubs.owner_id = club_staff.club_owner_id
      JOIN club_orders ON club_orders.club_id = clubs.id
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
        AND (club_staff.perm_bar = true OR club_staff.role IN ('admin', 'kitchen', 'bar_staff'))
        AND club_orders.id = club_order_items.order_id
    )
  );

-- 5. club_order_items: staff with bar perm can update order items
CREATE POLICY "Staff can update club order items"
  ON club_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      JOIN clubs ON clubs.owner_id = club_staff.club_owner_id
      JOIN club_orders ON club_orders.club_id = clubs.id
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
        AND (club_staff.perm_bar = true OR club_staff.role IN ('admin', 'kitchen', 'bar_staff'))
        AND club_orders.id = club_order_items.order_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_staff
      JOIN clubs ON clubs.owner_id = club_staff.club_owner_id
      JOIN club_orders ON club_orders.club_id = clubs.id
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
        AND (club_staff.perm_bar = true OR club_staff.role IN ('admin', 'kitchen', 'bar_staff'))
        AND club_orders.id = club_order_items.order_id
    )
  );

-- 6. club_tables: staff with bar perm can view tables
CREATE POLICY "Staff can view club tables"
  ON club_tables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
        AND club_staff.is_active = true
        AND (club_staff.perm_bar = true OR club_staff.role IN ('admin', 'kitchen', 'bar_staff'))
        AND club_tables.club_id IN (
          SELECT id FROM clubs WHERE owner_id = club_staff.club_owner_id
        )
    )
  );
