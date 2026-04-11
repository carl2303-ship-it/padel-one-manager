ALTER TABLE partner_match_requests
  DROP CONSTRAINT IF EXISTS partner_match_requests_side_preference_check;

ALTER TABLE partner_match_requests
  ADD CONSTRAINT partner_match_requests_side_preference_check
  CHECK (side_preference IN ('right', 'left', 'both'));
