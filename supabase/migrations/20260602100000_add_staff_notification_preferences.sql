-- Add notification preference columns to club_staff
-- Defaults to true so existing staff continue receiving notifications
ALTER TABLE club_staff
  ADD COLUMN IF NOT EXISTS notify_bookings boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_classes boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_qr boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cancellations boolean DEFAULT true;
