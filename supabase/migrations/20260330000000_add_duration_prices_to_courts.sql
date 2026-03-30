ALTER TABLE club_courts
ADD COLUMN IF NOT EXISTS price_90min decimal(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_240min decimal(10,2) DEFAULT NULL;

COMMENT ON COLUMN club_courts.price_90min IS 'Price for 90-minute booking. NULL means use hourly_rate * 1.5';
COMMENT ON COLUMN club_courts.price_240min IS 'Price for 240-minute (4h) booking. NULL means use hourly_rate * 4';
