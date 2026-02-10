/*
  # Club Management System - Core Tables
  
  This migration creates the foundational tables for the Padel Club Management system.
  These tables are ADDITIVE and do not modify any existing tournament-related tables.
  
  ## 1. New Tables
  
  ### Club Courts (club_courts)
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Owner/organizer who manages this court
  - `name` (text) - Court name (e.g., "Court 1", "Central Court")
  - `type` (text) - Court type: indoor, outdoor, covered
  - `hourly_rate` (decimal) - Standard hourly rate in euros
  - `peak_rate` (decimal) - Peak hours rate in euros
  - `is_active` (boolean) - Whether the court is available for booking
  - `description` (text) - Optional description
  - `created_at` (timestamptz) - Creation timestamp
  
  ### Court Bookings (court_bookings)
  - `id` (uuid, primary key) - Unique identifier
  - `court_id` (uuid) - Reference to club_courts
  - `user_id` (uuid) - User who made the booking
  - `booked_by_name` (text) - Name of person booking (for walk-ins)
  - `booked_by_phone` (text) - Phone of person booking
  - `start_time` (timestamptz) - Booking start time
  - `end_time` (timestamptz) - Booking end time
  - `status` (text) - confirmed, pending, cancelled
  - `price` (decimal) - Total price for the booking
  - `payment_status` (text) - paid, pending, refunded
  - `notes` (text) - Optional notes
  - `created_at` (timestamptz) - Creation timestamp
  
  ### Membership Plans (membership_plans)
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Owner/organizer who manages this plan
  - `name` (text) - Plan name (e.g., "Monthly", "Annual")
  - `duration_months` (integer) - Duration in months
  - `price` (decimal) - Plan price
  - `benefits` (jsonb) - List of benefits
  - `court_discount_percent` (integer) - Discount on court bookings
  - `is_active` (boolean) - Whether plan is available
  - `created_at` (timestamptz) - Creation timestamp
  
  ### Member Subscriptions (member_subscriptions)
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Member user ID
  - `plan_id` (uuid) - Reference to membership_plans
  - `club_owner_id` (uuid) - Owner of the club
  - `start_date` (date) - Subscription start
  - `end_date` (date) - Subscription end
  - `status` (text) - active, expired, cancelled
  - `amount_paid` (decimal) - Amount paid
  - `created_at` (timestamptz) - Creation timestamp
  
  ## 2. Security
  - RLS enabled on all tables
  - Owners can manage their own courts, plans
  - Users can view available courts and create bookings
  - Members can view their own subscriptions
*/

-- Club Courts table
CREATE TABLE IF NOT EXISTS club_courts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'indoor' CHECK (type IN ('indoor', 'outdoor', 'covered')),
  hourly_rate decimal(10,2) NOT NULL DEFAULT 0,
  peak_rate decimal(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE club_courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own courts"
  ON club_courts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view active courts"
  ON club_courts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Court Bookings table
CREATE TABLE IF NOT EXISTS court_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES club_courts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booked_by_name text,
  booked_by_phone text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  price decimal(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'refunded')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_times CHECK (end_time > start_time)
);

ALTER TABLE court_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Court owners can manage all bookings for their courts"
  ON court_bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_courts
      WHERE club_courts.id = court_bookings.court_id
      AND club_courts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_courts
      WHERE club_courts.id = court_bookings.court_id
      AND club_courts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own bookings"
  ON court_bookings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create bookings"
  ON court_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_courts
      WHERE club_courts.id = court_bookings.court_id
      AND club_courts.is_active = true
    )
  );

CREATE POLICY "Users can cancel their own bookings"
  ON court_bookings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Membership Plans table
CREATE TABLE IF NOT EXISTS membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_months integer NOT NULL DEFAULT 1,
  price decimal(10,2) NOT NULL DEFAULT 0,
  benefits jsonb DEFAULT '[]'::jsonb,
  court_discount_percent integer NOT NULL DEFAULT 0 CHECK (court_discount_percent >= 0 AND court_discount_percent <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own plans"
  ON membership_plans
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view active plans"
  ON membership_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Member Subscriptions table
CREATE TABLE IF NOT EXISTS member_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  amount_paid decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage subscriptions"
  ON member_subscriptions
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Members can view their own subscriptions"
  ON member_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_club_courts_user_id ON club_courts(user_id);
CREATE INDEX IF NOT EXISTS idx_club_courts_is_active ON club_courts(is_active);
CREATE INDEX IF NOT EXISTS idx_court_bookings_court_id ON court_bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_user_id ON court_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_start_time ON court_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_court_bookings_status ON court_bookings(status);
CREATE INDEX IF NOT EXISTS idx_membership_plans_user_id ON membership_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_user_id ON member_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_club_owner_id ON member_subscriptions(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_status ON member_subscriptions(status);
