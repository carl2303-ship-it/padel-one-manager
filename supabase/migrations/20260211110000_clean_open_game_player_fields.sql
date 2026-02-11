-- Clean up player fields from open_game bookings
-- These should not be counted in regular booking metrics

UPDATE court_bookings
SET 
  player1_name = NULL,
  player1_phone = NULL,
  player1_is_member = NULL,
  player1_discount = NULL,
  player2_name = NULL,
  player2_phone = NULL,
  player2_is_member = NULL,
  player2_discount = NULL,
  player3_name = NULL,
  player3_phone = NULL,
  player3_is_member = NULL,
  player3_discount = NULL,
  player4_name = NULL,
  player4_phone = NULL,
  player4_is_member = NULL,
  player4_discount = NULL
WHERE event_type = 'open_game';
