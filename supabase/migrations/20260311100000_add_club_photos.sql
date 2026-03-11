-- Add facility photo columns to clubs table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS photo_url_1 TEXT,
ADD COLUMN IF NOT EXISTS photo_url_2 TEXT;
