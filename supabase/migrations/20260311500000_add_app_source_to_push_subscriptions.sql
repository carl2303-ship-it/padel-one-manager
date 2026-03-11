/*
  # Add app_source column to push_subscriptions
  
  Distinguishes which app registered the push subscription
  so notifications are only sent to the correct app.
  
  Values: 'manager', 'tour', 'player'
*/

-- Add app_source column
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS app_source text DEFAULT 'manager';

-- Update existing subscriptions: set default based on whether they have player_account_id
UPDATE push_subscriptions SET app_source = 'tour' WHERE player_account_id IS NOT NULL AND app_source IS NULL;
UPDATE push_subscriptions SET app_source = 'manager' WHERE user_id IS NOT NULL AND player_account_id IS NULL AND app_source IS NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_app_source ON push_subscriptions(app_source);
