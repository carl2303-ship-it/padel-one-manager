/*
  # Add notes field to member subscriptions

  1. Changes
    - Add notes column to member_subscriptions table
    - Allows club owners to add notes about each member
  
  2. Details
    - notes: text field for any additional information about the member
    - nullable field (optional)
*/

ALTER TABLE member_subscriptions 
  ADD COLUMN IF NOT EXISTS notes text;