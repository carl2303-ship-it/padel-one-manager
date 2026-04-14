-- ==========================================================================
-- Tournament Invite System: visibility column + tournament_invites table
-- ==========================================================================

-- 1. Add visibility column to tournaments
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Add constraint (safe: drop first if exists)
DO $$
BEGIN
  ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_visibility_check;
  ALTER TABLE tournaments ADD CONSTRAINT tournaments_visibility_check
    CHECK (visibility IN ('public', 'invite_only'));
END;
$$;

-- Backfill existing tournaments
UPDATE tournaments SET visibility = 'public' WHERE visibility IS NULL;

-- ==========================================================================
-- 2. Create tournament_invites table
-- ==========================================================================
CREATE TABLE IF NOT EXISTS tournament_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_account_id uuid NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, player_account_id)
);

ALTER TABLE tournament_invites ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tournament_invites_tournament ON tournament_invites(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_invites_player ON tournament_invites(player_account_id);
CREATE INDEX IF NOT EXISTS idx_tournament_invites_status ON tournament_invites(status);

-- ==========================================================================
-- 3. RLS Policies
-- ==========================================================================

-- Organizer (tournament owner) can manage invites
DROP POLICY IF EXISTS "Tournament owner can manage invites" ON tournament_invites;
CREATE POLICY "Tournament owner can manage invites"
  ON tournament_invites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_invites.tournament_id
        AND tournaments.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE tournaments.id = tournament_invites.tournament_id
        AND tournaments.user_id = auth.uid()
    )
  );

-- Invited players can view their own invites
DROP POLICY IF EXISTS "Players can view own invites" ON tournament_invites;
CREATE POLICY "Players can view own invites"
  ON tournament_invites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_accounts
      WHERE player_accounts.id = tournament_invites.player_account_id
        AND player_accounts.user_id = auth.uid()
    )
  );

-- Invited players can update their own invite status (accept/decline)
DROP POLICY IF EXISTS "Players can update own invite status" ON tournament_invites;
CREATE POLICY "Players can update own invite status"
  ON tournament_invites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_accounts
      WHERE player_accounts.id = tournament_invites.player_account_id
        AND player_accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_accounts
      WHERE player_accounts.id = tournament_invites.player_account_id
        AND player_accounts.user_id = auth.uid()
    )
  );

-- Super admins can view all invites
DROP POLICY IF EXISTS "Super admins can view all invites" ON tournament_invites;
CREATE POLICY "Super admins can view all invites"
  ON tournament_invites FOR SELECT
  TO authenticated
  USING (public.is_super_admin());
