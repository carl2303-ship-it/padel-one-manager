ALTER TABLE club_courts
ADD COLUMN IF NOT EXISTS price_90min decimal(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_120min decimal(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peak_price_90min decimal(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peak_price_120min decimal(10,2) DEFAULT NULL;

ALTER TABLE club_courts DROP COLUMN IF EXISTS price_240min;

COMMENT ON COLUMN club_courts.price_90min IS 'Price for 90-minute booking. NULL means use hourly_rate * 1.5';
COMMENT ON COLUMN club_courts.price_120min IS 'Price for 120-minute (2h) booking. NULL means use hourly_rate * 2';
COMMENT ON COLUMN club_courts.peak_price_90min IS 'Peak price for 90-minute booking. NULL means use peak_rate * 1.5';
COMMENT ON COLUMN club_courts.peak_price_120min IS 'Peak price for 120-minute booking. NULL means use peak_rate * 2';
