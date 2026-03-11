-- Unify bar_orders and club_orders into a single table (club_orders)
-- Add source column to distinguish manual vs QR orders
-- Add club_owner_id to club_orders so both manual and QR can be queried by owner

ALTER TABLE club_orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'qr';
ALTER TABLE club_orders ADD COLUMN IF NOT EXISTS club_owner_id uuid;
ALTER TABLE club_orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

-- Add is_food column to club_order_items if missing
ALTER TABLE club_order_items ADD COLUMN IF NOT EXISTS is_food boolean NOT NULL DEFAULT false;

-- Migrate existing bar_orders into club_orders
INSERT INTO club_orders (club_id, club_owner_id, table_number, customer_name, notes, total, status, payment_status, source, created_at)
SELECT 
  NULL,
  bo.club_owner_id,
  bo.table_number,
  bo.customer_name,
  bo.notes,
  bo.total,
  bo.status,
  bo.payment_status,
  'manual',
  bo.created_at
FROM bar_orders bo
WHERE NOT EXISTS (
  SELECT 1 FROM club_orders co 
  WHERE co.created_at = bo.created_at 
    AND co.club_owner_id = bo.club_owner_id
    AND co.source = 'manual'
);

-- Backfill club_owner_id for existing QR orders (from club_id)
UPDATE club_orders co
SET club_owner_id = c.owner_id
FROM clubs c
WHERE co.club_id = c.id
  AND co.club_owner_id IS NULL;
