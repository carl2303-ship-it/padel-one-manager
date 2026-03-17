/*
  # Add payment_status to class_enrollments

  Adds payment_status column to track if each student has paid for the class.
*/

ALTER TABLE class_enrollments
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid'));
