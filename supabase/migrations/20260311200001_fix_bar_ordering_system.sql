-- Fix: Add is_food to existing menu_items, add anon policies, 
-- drop duplicate tables, update club_staff role constraint

-- 1. Add is_food column to existing menu_items (if not exists)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT false;

-- 2. Fix club_order_items to reference menu_items (not club_menu_items)
-- Drop and recreate if needed
DO $$
BEGIN
  -- Check if club_order_items exists and has wrong FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%club_order_items_menu_item_id_fkey%' 
    AND table_name = 'club_order_items'
  ) THEN
    ALTER TABLE club_order_items DROP CONSTRAINT IF EXISTS club_order_items_menu_item_id_fkey;
    ALTER TABLE club_order_items ADD CONSTRAINT club_order_items_menu_item_id_fkey 
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Add anon read access to existing menu tables
DO $$
BEGIN
  CREATE POLICY "Anon can view active menu categories"
    ON menu_categories FOR SELECT TO anon
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Anon can view available menu items"
    ON menu_items FOR SELECT TO anon
    USING (is_available = true);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 4. Add kitchen role to club_staff
DO $$
BEGIN
  ALTER TABLE club_staff DROP CONSTRAINT IF EXISTS club_staff_role_check;
  ALTER TABLE club_staff ADD CONSTRAINT club_staff_role_check
    CHECK (role IN ('admin', 'bar_staff', 'coach', 'receptionist', 'kitchen', 'other'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 5. Drop duplicate tables that were created but not needed
DROP TABLE IF EXISTS club_menu_items CASCADE;
DROP TABLE IF EXISTS club_menu_categories CASCADE;
