-- Add optional kitchen availability schedule to food menu items.
-- Each item can have up to 2 time slots (e.g. lunch + dinner).
-- NULL means "always available" (no schedule restriction).

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS kitchen_slot1_start time;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS kitchen_slot1_end   time;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS kitchen_slot2_start time;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS kitchen_slot2_end   time;
