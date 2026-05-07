-- Add geolocation and photo gallery columns to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS num_courts integer;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}';

COMMENT ON COLUMN clubs.latitude IS 'GPS latitude for Google Maps embed';
COMMENT ON COLUMN clubs.longitude IS 'GPS longitude for Google Maps embed';
COMMENT ON COLUMN clubs.cover_image_url IS 'Main cover photo (hero image)';
COMMENT ON COLUMN clubs.photos IS 'Array of photo URLs for gallery';
COMMENT ON COLUMN clubs.num_courts IS 'Number of padel courts';
COMMENT ON COLUMN clubs.amenities IS 'List of amenities (e.g. parking, bar, showers)';
