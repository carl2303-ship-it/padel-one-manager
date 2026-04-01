ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_highlighted boolean DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
