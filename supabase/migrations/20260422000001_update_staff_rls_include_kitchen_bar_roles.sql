/*
  # Update Staff RLS: include kitchen and bar_staff roles

  The original policies only checked perm_bar = true OR role = 'admin'.
  Kitchen and bar_staff roles should implicitly have bar access.
*/

-- club_orders SELECT
DROP POLICY IF EXISTS "Staff can view club orders" ON club_orders;
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

-- club_orders UPDATE
DROP POLICY IF EXISTS "Staff can update club orders" ON club_orders;
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

-- club_order_items SELECT
DROP POLICY IF EXISTS "Staff can view club order items" ON club_order_items;
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

-- club_order_items UPDATE
DROP POLICY IF EXISTS "Staff can update club order items" ON club_order_items;
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

-- club_tables SELECT
DROP POLICY IF EXISTS "Staff can view club tables" ON club_tables;
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
