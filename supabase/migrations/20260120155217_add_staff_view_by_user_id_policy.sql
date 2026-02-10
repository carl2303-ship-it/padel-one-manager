/*
  # Add staff view policy by user_id

  1. Problem
    - Current policy uses email matching which requires complex function
    
  2. Solution
    - Add simpler policy that uses user_id directly with auth.uid()
*/

-- Add policy for staff to view their own record by user_id (simpler and more reliable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'club_staff' AND policyname = 'Staff can view own record by user_id'
  ) THEN
    CREATE POLICY "Staff can view own record by user_id"
      ON club_staff FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
