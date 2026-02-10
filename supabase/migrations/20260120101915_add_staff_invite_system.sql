/*
  # Staff Invite System

  This migration adds invite functionality to the club_staff table.

  ## 1. New Columns
  - `invite_token` (text, nullable) - Unique token for invite link
  - `invite_sent_at` (timestamptz, nullable) - When invite was sent
  - `invite_expires_at` (timestamptz, nullable) - When invite expires
  - `invite_accepted_at` (timestamptz, nullable) - When invite was accepted

  ## 2. Security
  - Add policy for staff to view their own record when logged in
  - Add policy for anonymous users to view staff record by invite token
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_staff' AND column_name = 'invite_token'
  ) THEN
    ALTER TABLE club_staff ADD COLUMN invite_token text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_staff' AND column_name = 'invite_sent_at'
  ) THEN
    ALTER TABLE club_staff ADD COLUMN invite_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_staff' AND column_name = 'invite_expires_at'
  ) THEN
    ALTER TABLE club_staff ADD COLUMN invite_expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'club_staff' AND column_name = 'invite_accepted_at'
  ) THEN
    ALTER TABLE club_staff ADD COLUMN invite_accepted_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_club_staff_invite_token ON club_staff(invite_token) WHERE invite_token IS NOT NULL;

DROP POLICY IF EXISTS "Staff can view own record" ON club_staff;
CREATE POLICY "Staff can view own record"
  ON club_staff
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view staff by invite token" ON club_staff;
CREATE POLICY "Anyone can view staff by invite token"
  ON club_staff
  FOR SELECT
  TO anon
  USING (invite_token IS NOT NULL AND invite_expires_at > now());

DROP POLICY IF EXISTS "Anon can update staff to accept invite" ON club_staff;
CREATE POLICY "Anon can update staff to accept invite"
  ON club_staff
  FOR UPDATE
  TO anon
  USING (invite_token IS NOT NULL AND invite_expires_at > now())
  WITH CHECK (invite_token IS NOT NULL);
