-- Allow clubs to exist without an owner (listing/ficha mode)
-- Super admin creates club listings that players can see; later an owner is assigned

ALTER TABLE clubs ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_managed boolean NOT NULL DEFAULT false;

-- Super admin can INSERT new clubs (listings)
DROP POLICY IF EXISTS "Super admins can insert clubs" ON clubs;
CREATE POLICY "Super admins can insert clubs"
  ON clubs FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Ensure authenticated users can also see active clubs (for Player app)
DROP POLICY IF EXISTS "Authenticated can view active clubs" ON clubs;
CREATE POLICY "Authenticated can view active clubs"
  ON clubs FOR SELECT TO authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_clubs_is_managed ON clubs(is_managed);

-- Super admin can INSERT new super_admins
DROP POLICY IF EXISTS "Super admins can insert super_admins" ON super_admins;
CREATE POLICY "Super admins can insert super_admins"
  ON super_admins FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Super admin can DELETE super_admins
DROP POLICY IF EXISTS "Super admins can delete super_admins" ON super_admins;
CREATE POLICY "Super admins can delete super_admins"
  ON super_admins FOR DELETE TO authenticated
  USING (public.is_super_admin());
