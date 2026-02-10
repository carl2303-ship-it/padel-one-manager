/*
  # Add staff access to all club management tables

  1. Problem
    - Staff members cannot access club data (courts, bookings, members, classes)
    - Only bar_orders had staff policies
    
  2. Solution
    - Add SELECT policies for staff to view club data
*/

-- Staff can view club courts
CREATE POLICY "Staff can view club courts"
  ON club_courts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = club_courts.user_id
      AND club_staff.is_active = true
    )
  );

-- Staff can view court bookings
CREATE POLICY "Staff can view court bookings"
  ON court_bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      JOIN club_courts ON club_courts.user_id = club_staff.club_owner_id
      WHERE club_staff.user_id = auth.uid()
      AND club_courts.id = court_bookings.court_id
      AND club_staff.is_active = true
    )
  );

-- Staff can view member subscriptions
CREATE POLICY "Staff can view member subscriptions"
  ON member_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = member_subscriptions.club_owner_id
      AND club_staff.is_active = true
    )
  );

-- Staff can view membership plans (uses user_id not club_owner_id)
CREATE POLICY "Staff can view membership plans"
  ON membership_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = membership_plans.user_id
      AND club_staff.is_active = true
    )
  );

-- Staff can view club classes
CREATE POLICY "Staff can view club classes"
  ON club_classes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.user_id = auth.uid()
      AND club_staff.club_owner_id = club_classes.club_owner_id
      AND club_staff.is_active = true
    )
  );
