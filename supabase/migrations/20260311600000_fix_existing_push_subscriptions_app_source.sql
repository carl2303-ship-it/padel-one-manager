/*
  Fix existing push_subscriptions app_source values.
  
  The previous migration defaulted everything to 'manager', but Tour app
  subscriptions (registered by organizers using user_id) were also marked as 'manager'.
  
  Since we can't distinguish existing subs by app, we delete all existing
  push_subscriptions so users re-register with the correct app_source.
  This is a one-time cleanup.
*/

-- Delete all existing subscriptions to force re-registration with correct app_source
DELETE FROM push_subscriptions;
