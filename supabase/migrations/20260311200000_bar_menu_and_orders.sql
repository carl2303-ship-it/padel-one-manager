-- ============================================
-- BAR MENU QR ORDERING SYSTEM
-- ============================================

-- 1. Add is_food column to existing menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT false;

-- 2. Club Tables (for QR code management)
CREATE TABLE IF NOT EXISTS club_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, table_number)
);

-- 3. QR Orders (from customers scanning QR codes)
CREATE TABLE IF NOT EXISTS club_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  total DECIMAL(10,2) DEFAULT 0,
  customer_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. QR Order Items
CREATE TABLE IF NOT EXISTS club_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES club_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_food BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_club_tables_club ON club_tables(club_id);
CREATE INDEX IF NOT EXISTS idx_club_orders_club ON club_orders(club_id);
CREATE INDEX IF NOT EXISTS idx_club_orders_status ON club_orders(club_id, status);
CREATE INDEX IF NOT EXISTS idx_club_order_items_order ON club_order_items(order_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE club_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_order_items ENABLE ROW LEVEL SECURITY;

-- Club tables: owners can manage, anyone can view
CREATE POLICY "Club owners can manage tables"
  ON club_tables FOR ALL TO authenticated
  USING (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

CREATE POLICY "Anyone can view active tables"
  ON club_tables FOR SELECT TO anon
  USING (is_active = true);

-- Orders: owners can view/manage, anyone can create and view
CREATE POLICY "Club owners can manage orders"
  ON club_orders FOR ALL TO authenticated
  USING (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

CREATE POLICY "Anyone can create orders"
  ON club_orders FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view orders"
  ON club_orders FOR SELECT TO anon
  USING (true);

-- Order items: owners can manage, anyone can create and view
CREATE POLICY "Club owners can manage order items"
  ON club_order_items FOR ALL TO authenticated
  USING (order_id IN (
    SELECT id FROM club_orders WHERE club_id IN (
      SELECT id FROM clubs WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Anyone can create order items"
  ON club_order_items FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view order items"
  ON club_order_items FOR SELECT TO anon
  USING (true);

-- Add anon read access to existing menu tables for public menu page
CREATE POLICY "Anon can view active menu categories"
  ON menu_categories FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Anon can view available menu items"
  ON menu_items FOR SELECT TO anon
  USING (is_available = true);

-- ============================================
-- Add kitchen role to club_staff
-- ============================================
DO $$
BEGIN
  ALTER TABLE club_staff DROP CONSTRAINT IF EXISTS club_staff_role_check;
  ALTER TABLE club_staff ADD CONSTRAINT club_staff_role_check
    CHECK (role IN ('admin', 'bar_staff', 'coach', 'receptionist', 'kitchen', 'other'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================
-- Enable realtime for orders
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE club_orders;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE club_order_items;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Drop new tables that duplicate existing functionality
DROP TABLE IF EXISTS club_menu_items CASCADE;
DROP TABLE IF EXISTS club_menu_categories CASCADE;
