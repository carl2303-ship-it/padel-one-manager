/*
  # Add Staff Access to Bar/Menu Tables

  1. Changes
    - Add SELECT policies for staff members on menu_categories, menu_items, bar_orders
    - Staff can view all data belonging to their club owner (not just active/available items)
    - Add UPDATE policies for staff with bar permissions

  2. Security
    - Staff access is verified through club_staff table
    - Only active staff members with perm_bar permission can modify data
*/

-- Staff can view all menu categories (including inactive) for their club owner
CREATE POLICY "Staff can view club menu categories"
  ON menu_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = menu_categories.club_owner_id
      AND club_staff.is_active = true
    )
  );

-- Staff can view all menu items (including unavailable) for their club owner
CREATE POLICY "Staff can view club menu items"
  ON menu_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = menu_items.club_owner_id
      AND club_staff.is_active = true
    )
  );

-- Staff can view all orders for their club owner
CREATE POLICY "Staff can view club orders"
  ON bar_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = bar_orders.club_owner_id
      AND club_staff.is_active = true
    )
  );

-- Staff with bar permission can update menu items (toggle availability)
CREATE POLICY "Staff can update menu items"
  ON menu_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = menu_items.club_owner_id
      AND club_staff.is_active = true
      AND (club_staff.perm_bar = true OR club_staff.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = menu_items.club_owner_id
      AND club_staff.is_active = true
      AND (club_staff.perm_bar = true OR club_staff.role = 'admin')
    )
  );

-- Staff with bar permission can update orders (change status)
CREATE POLICY "Staff can update orders"
  ON bar_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = bar_orders.club_owner_id
      AND club_staff.is_active = true
      AND (club_staff.perm_bar = true OR club_staff.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = bar_orders.club_owner_id
      AND club_staff.is_active = true
      AND (club_staff.perm_bar = true OR club_staff.role = 'admin')
    )
  );
