/*
  # Add Member Details to Subscriptions

  1. Changes
    - Add `member_name` column to store the member's name
    - Add `member_email` column to store the member's email
    - Add `member_phone` column to store the member's phone number
  
  2. Notes
    - These fields allow creating subscriptions without requiring an auth user
    - Existing subscriptions will have NULL values for these new columns
*/

ALTER TABLE member_subscriptions
ADD COLUMN IF NOT EXISTS member_name text,
ADD COLUMN IF NOT EXISTS member_email text,
ADD COLUMN IF NOT EXISTS member_phone text;