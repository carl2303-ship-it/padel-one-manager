/*
  # Create sponsors and advertising management table

  1. New Tables
    - `club_sponsors`
      - `id` (uuid, primary key)
      - `club_owner_id` (uuid, references auth.users)
      - `name` (text) - Sponsor/advertiser name
      - `type` (text) - 'sponsor', 'court_ad', 'outdoor', 'digital', 'other'
      - `description` (text) - Details about the sponsorship
      - `location` (text) - Where the ad is placed (court name, outdoor location, etc)
      - `contract_start` (date) - Contract start date
      - `contract_end` (date) - Contract end date
      - `monthly_value` (numeric) - Monthly payment value
      - `total_value` (numeric) - Total contract value
      - `payment_frequency` (text) - 'monthly', 'quarterly', 'yearly', 'one_time'
      - `contact_name` (text) - Contact person
      - `contact_email` (text)
      - `contact_phone` (text)
      - `logo_url` (text) - Sponsor logo
      - `is_active` (boolean)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `club_sponsor_payments`
      - `id` (uuid, primary key)
      - `sponsor_id` (uuid, references club_sponsors)
      - `amount` (numeric)
      - `payment_date` (date)
      - `reference_period` (text) - e.g., 'Jan 2026', 'Q1 2026'
      - `status` (text) - 'pending', 'paid', 'overdue'
      - `notes` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for club owners and staff
*/

CREATE TABLE IF NOT EXISTS club_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'sponsor' CHECK (type IN ('sponsor', 'court_ad', 'outdoor', 'digital', 'event', 'other')),
  description text,
  location text,
  contract_start date,
  contract_end date,
  monthly_value numeric DEFAULT 0,
  total_value numeric DEFAULT 0,
  payment_frequency text DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'quarterly', 'yearly', 'one_time')),
  contact_name text,
  contact_email text,
  contact_phone text,
  logo_url text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS club_sponsor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES club_sponsors(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL,
  reference_period text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_sponsor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their sponsors"
  ON club_sponsors FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Staff can view sponsors"
  ON club_sponsors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_staff
      WHERE club_staff.club_owner_id = club_sponsors.club_owner_id
      AND club_staff.user_id = auth.uid()
      AND club_staff.is_active = true
    )
  );

CREATE POLICY "Club owners can manage sponsor payments"
  ON club_sponsor_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_sponsors
      WHERE club_sponsors.id = club_sponsor_payments.sponsor_id
      AND club_sponsors.club_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_sponsors
      WHERE club_sponsors.id = club_sponsor_payments.sponsor_id
      AND club_sponsors.club_owner_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view sponsor payments"
  ON club_sponsor_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_sponsors
      JOIN club_staff ON club_staff.club_owner_id = club_sponsors.club_owner_id
      WHERE club_sponsors.id = club_sponsor_payments.sponsor_id
      AND club_staff.user_id = auth.uid()
      AND club_staff.is_active = true
    )
  );

CREATE INDEX idx_club_sponsors_owner ON club_sponsors(club_owner_id);
CREATE INDEX idx_club_sponsors_active ON club_sponsors(club_owner_id, is_active);
CREATE INDEX idx_club_sponsor_payments_sponsor ON club_sponsor_payments(sponsor_id);
CREATE INDEX idx_club_sponsor_payments_date ON club_sponsor_payments(payment_date);