-- Super Admin global read/write policies for HQ
-- Uses the existing is_super_admin() function from 20260121164725
-- DROP IF EXISTS to be idempotent (some policies may already exist)

-- clubs
DROP POLICY IF EXISTS "Super admins can view all clubs" ON clubs;
CREATE POLICY "Super admins can view all clubs"
  ON clubs FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can update all clubs" ON clubs;
CREATE POLICY "Super admins can update all clubs"
  ON clubs FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- club_courts
DROP POLICY IF EXISTS "Super admins can view all club_courts" ON club_courts;
CREATE POLICY "Super admins can view all club_courts"
  ON club_courts FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- court_bookings
DROP POLICY IF EXISTS "Super admins can view all court_bookings" ON court_bookings;
CREATE POLICY "Super admins can view all court_bookings"
  ON court_bookings FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- club_staff
DROP POLICY IF EXISTS "Super admins can view all club_staff" ON club_staff;
CREATE POLICY "Super admins can view all club_staff"
  ON club_staff FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- player_accounts
DROP POLICY IF EXISTS "Super admins can view all player_accounts" ON player_accounts;
CREATE POLICY "Super admins can view all player_accounts"
  ON player_accounts FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- player_transactions
DROP POLICY IF EXISTS "Super admins can view all player_transactions" ON player_transactions;
CREATE POLICY "Super admins can view all player_transactions"
  ON player_transactions FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can insert player_transactions" ON player_transactions;
CREATE POLICY "Super admins can insert player_transactions"
  ON player_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- user_logo_settings
DROP POLICY IF EXISTS "Super admins can view all user_logo_settings" ON user_logo_settings;
CREATE POLICY "Super admins can view all user_logo_settings"
  ON user_logo_settings FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- tournaments
DROP POLICY IF EXISTS "Super admins can view all tournaments" ON tournaments;
CREATE POLICY "Super admins can view all tournaments"
  ON tournaments FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- membership_plans
DROP POLICY IF EXISTS "Super admins can view all membership_plans" ON membership_plans;
CREATE POLICY "Super admins can view all membership_plans"
  ON membership_plans FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- member_subscriptions
DROP POLICY IF EXISTS "Super admins can view all member_subscriptions" ON member_subscriptions;
CREATE POLICY "Super admins can view all member_subscriptions"
  ON member_subscriptions FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- open_games
DROP POLICY IF EXISTS "Super admins can view all open_games" ON open_games;
CREATE POLICY "Super admins can view all open_games"
  ON open_games FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- open_game_players
DROP POLICY IF EXISTS "Super admins can view all open_game_players" ON open_game_players;
CREATE POLICY "Super admins can view all open_game_players"
  ON open_game_players FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- super_admins
DROP POLICY IF EXISTS "Super admins can view all super_admins" ON super_admins;
CREATE POLICY "Super admins can view all super_admins"
  ON super_admins FOR SELECT TO authenticated
  USING (public.is_super_admin());
