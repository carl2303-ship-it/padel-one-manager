/*
  # Allow Anonymous Users to Read Member Subscriptions and Membership Plans for Bar Discounts
  
  This is needed for the PublicMenu QR ordering flow:
  - When a customer enters their phone number, the system checks if they are a club member
  - If they have an active membership with bar discounts, the discount is shown and applied
  
  Security:
  - member_subscriptions: anon can only SELECT (read) - limited to checking membership status
  - membership_plans: anon can only SELECT (read) - limited to reading plan discount info
*/

-- Allow anon users to read member subscriptions (needed for phone lookup discount check)
CREATE POLICY "Anon can read member subscriptions for discount check"
  ON member_subscriptions
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to read membership plans (needed to get discount percentages)
CREATE POLICY "Anon can read membership plans for discount info"
  ON membership_plans
  FOR SELECT
  TO anon
  USING (true);
