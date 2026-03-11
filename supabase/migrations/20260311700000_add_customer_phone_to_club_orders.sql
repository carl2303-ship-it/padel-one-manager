-- Add customer_phone column to club_orders for membership discount lookup
ALTER TABLE club_orders ADD COLUMN IF NOT EXISTS customer_phone text;
