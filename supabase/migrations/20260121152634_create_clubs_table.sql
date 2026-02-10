/*
  # Create Clubs Table

  1. New Tables
    - `clubs`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users) - the user who owns/manages this club
      - `name` (text) - club name (e.g., "Albufeira Padel Clube", "Padel Blu")
      - `description` (text, optional) - club description
      - `logo_url` (text, optional) - club logo
      - `address` (text, optional) - physical address
      - `city` (text, optional) - city
      - `country` (text, optional) - country
      - `phone` (text, optional) - contact phone
      - `email` (text, optional) - contact email
      - `website` (text, optional) - website URL
      - `is_active` (boolean) - whether club is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `club_id` (uuid, optional) to `tournaments` table
    - Add `club_id` (uuid, optional) to `leagues` table

  3. Security
    - Enable RLS on `clubs` table
    - Owners can manage their own clubs
    - Public can view active clubs

  4. Important Notes
    - club_id is OPTIONAL on tournaments/leagues (NULL by default)
    - Existing data is NOT migrated automatically
    - This is a non-destructive migration
*/

-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text DEFAULT '',
  logo_url text,
  address text,
  city text,
  country text DEFAULT 'Portugal',
  phone text,
  email text,
  website text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can view their own clubs
CREATE POLICY "Owners can view own clubs"
  ON clubs FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Policy: Anyone can view active clubs (for public tournament pages)
CREATE POLICY "Anyone can view active clubs"
  ON clubs FOR SELECT
  TO anon
  USING (is_active = true);

-- Policy: Owners can insert their own clubs
CREATE POLICY "Owners can create clubs"
  ON clubs FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Policy: Owners can update their own clubs
CREATE POLICY "Owners can update own clubs"
  ON clubs FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Policy: Owners can delete their own clubs
CREATE POLICY "Owners can delete own clubs"
  ON clubs FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Add club_id to tournaments (optional, NULL by default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'club_id'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN club_id uuid REFERENCES clubs(id);
  END IF;
END $$;

-- Add club_id to leagues (optional, NULL by default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leagues' AND column_name = 'club_id'
  ) THEN
    ALTER TABLE leagues ADD COLUMN club_id uuid REFERENCES clubs(id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clubs_owner_id ON clubs(owner_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_club_id ON tournaments(club_id);
CREATE INDEX IF NOT EXISTS idx_leagues_club_id ON leagues(club_id);
