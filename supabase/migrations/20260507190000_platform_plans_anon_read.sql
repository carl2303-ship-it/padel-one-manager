-- Public landing page (Player app /clubs) reads club plans without auth
DROP POLICY IF EXISTS "Anon can read active plans" ON platform_plans;
CREATE POLICY "Anon can read active plans"
  ON platform_plans FOR SELECT TO anon
  USING (is_active = true);
