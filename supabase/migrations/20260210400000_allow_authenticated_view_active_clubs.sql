/*
  # Allow authenticated users to view active clubs

  The existing RLS only allows:
  - Club owners (authenticated) to see their OWN clubs
  - Anonymous users to see active clubs

  Players in the Player app are authenticated but NOT club owners,
  so they couldn't see any clubs. This migration adds a policy
  so authenticated users can also view active clubs.
*/

-- Allow authenticated users to view active clubs (for Player app)
CREATE POLICY "Authenticated can view active clubs"
  ON clubs FOR SELECT
  TO authenticated
  USING (is_active = true);
