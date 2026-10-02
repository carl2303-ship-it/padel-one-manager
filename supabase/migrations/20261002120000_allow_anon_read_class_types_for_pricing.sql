-- Allow anonymous users to read active class types
-- Needed for the public pricing page (/pricing/:clubId) which shows academy prices

DROP POLICY IF EXISTS "Anon can view active class types" ON class_types;

CREATE POLICY "Anon can view active class types"
  ON class_types
  FOR SELECT
  TO anon
  USING (is_active = true);

GRANT SELECT ON class_types TO anon;
