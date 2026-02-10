/*
  # Add bar and academy discounts to membership plans

  1. Changes
    - Add `bar_discount_percent` column to `membership_plans` table (integer, default 0)
    - Add `academy_discount_percent` column to `membership_plans` table (integer, default 0)

  2. Notes
    - These allow organizers to define discounts for bar purchases and academy classes per membership plan
    - Default value is 0 (no discount)
    - Values represent percentage discount (0-100)
*/

ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS bar_discount_percent integer DEFAULT 0;

ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS academy_discount_percent integer DEFAULT 0;
