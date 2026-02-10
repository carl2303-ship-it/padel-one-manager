/*
  # Link class enrollments to member subscriptions

  1. Changes
    - Add `member_subscription_id` column to `class_enrollments` table
    - This allows linking enrolled students to existing club members
    - When a student is linked to a member, their profile data can be associated

  2. Security
    - No RLS changes needed - existing policies cover this table
*/

ALTER TABLE class_enrollments
ADD COLUMN IF NOT EXISTS member_subscription_id uuid REFERENCES member_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_enrollments_member_subscription 
ON class_enrollments(member_subscription_id) 
WHERE member_subscription_id IS NOT NULL;