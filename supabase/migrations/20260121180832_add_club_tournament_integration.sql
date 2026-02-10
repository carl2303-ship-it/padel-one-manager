/*
  # Club-Tournament Integration System
  
  This migration creates the invisible integration between the club management 
  system and the tournament management system.
  
  1. New Columns
    - `member_subscriptions.player_account_id` - Links members to their player accounts
    - `court_bookings.tournament_match_id` - Links bookings to tournament matches
    
  2. New Functions
    - `link_member_to_player_account()` - Auto-links members by phone number
    - `create_tournament_court_bookings()` - Creates court bookings from tournament matches
    - `sync_tournament_bookings_for_club()` - Syncs all matches for a club's tournament
    
  3. New Triggers
    - Auto-link members to player accounts when member is created/updated
    - Auto-create bookings when tournament matches are scheduled
    
  4. Security
    - Functions use SECURITY DEFINER for cross-table operations
    - All new columns maintain existing RLS policies
*/

-- Add player_account_id to member_subscriptions for linking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_subscriptions' AND column_name = 'player_account_id'
  ) THEN
    ALTER TABLE member_subscriptions ADD COLUMN player_account_id uuid REFERENCES player_accounts(id);
  END IF;
END $$;

-- Add tournament_match_id to court_bookings for tracking tournament reservations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'court_bookings' AND column_name = 'tournament_match_id'
  ) THEN
    ALTER TABLE court_bookings ADD COLUMN tournament_match_id uuid REFERENCES matches(id);
  END IF;
END $$;

-- Add tournament_id to court_bookings for easier filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'court_bookings' AND column_name = 'tournament_id'
  ) THEN
    ALTER TABLE court_bookings ADD COLUMN tournament_id uuid REFERENCES tournaments(id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_court_bookings_tournament_match_id ON court_bookings(tournament_match_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_tournament_id ON court_bookings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_player_account_id ON member_subscriptions(player_account_id);

-- Function to normalize phone numbers for comparison
CREATE OR REPLACE FUNCTION normalize_phone_for_matching(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF phone IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$;

-- Function to auto-link member to player account by phone
CREATE OR REPLACE FUNCTION link_member_to_player_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_account_id uuid;
  v_normalized_phone text;
BEGIN
  IF NEW.member_phone IS NOT NULL AND NEW.player_account_id IS NULL THEN
    v_normalized_phone := normalize_phone_for_matching(NEW.member_phone);
    
    SELECT id INTO v_player_account_id
    FROM player_accounts
    WHERE normalize_phone_for_matching(phone_number) = v_normalized_phone
    LIMIT 1;
    
    IF v_player_account_id IS NOT NULL THEN
      NEW.player_account_id := v_player_account_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-linking members
DROP TRIGGER IF EXISTS trigger_link_member_to_player ON member_subscriptions;
CREATE TRIGGER trigger_link_member_to_player
  BEFORE INSERT OR UPDATE OF member_phone ON member_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION link_member_to_player_account();

-- Function to create court booking from a tournament match
CREATE OR REPLACE FUNCTION create_booking_from_match(
  p_match_id uuid,
  p_court_id uuid,
  p_club_owner_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_tournament RECORD;
  v_booking_id uuid;
  v_player_names text[];
  v_end_time timestamptz;
BEGIN
  SELECT m.*, t.match_duration_minutes, t.name as tournament_name, t.club_id
  INTO v_match
  FROM matches m
  JOIN tournaments t ON t.id = m.tournament_id
  WHERE m.id = p_match_id;
  
  IF v_match IS NULL OR v_match.scheduled_time IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_end_time := v_match.scheduled_time + (COALESCE(v_match.match_duration_minutes, 90) || ' minutes')::interval;
  
  IF EXISTS (
    SELECT 1 FROM court_bookings
    WHERE tournament_match_id = p_match_id
  ) THEN
    UPDATE court_bookings
    SET 
      start_time = v_match.scheduled_time,
      end_time = v_end_time,
      court_id = p_court_id,
      notes = 'Tournament: ' || v_match.tournament_name || ' - Match #' || v_match.match_number
    WHERE tournament_match_id = p_match_id
    RETURNING id INTO v_booking_id;
    
    RETURN v_booking_id;
  END IF;
  
  INSERT INTO court_bookings (
    court_id,
    start_time,
    end_time,
    status,
    event_type,
    notes,
    tournament_match_id,
    tournament_id,
    booked_by_name
  )
  VALUES (
    p_court_id,
    v_match.scheduled_time,
    v_end_time,
    'confirmed',
    'tournament',
    'Tournament: ' || v_match.tournament_name || ' - Match #' || v_match.match_number,
    p_match_id,
    v_match.tournament_id,
    v_match.tournament_name
  )
  RETURNING id INTO v_booking_id;
  
  RETURN v_booking_id;
END;
$$;

-- Function to sync all tournament matches to court bookings
CREATE OR REPLACE FUNCTION sync_tournament_bookings(p_tournament_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament RECORD;
  v_match RECORD;
  v_court_id uuid;
  v_courts RECORD;
  v_court_map jsonb := '{}';
  v_count integer := 0;
  v_court_number integer;
BEGIN
  SELECT t.*, c.owner_id as club_owner_id
  INTO v_tournament
  FROM tournaments t
  JOIN clubs c ON c.id = t.club_id
  WHERE t.id = p_tournament_id AND t.club_id IS NOT NULL;
  
  IF v_tournament IS NULL THEN
    RETURN 0;
  END IF;
  
  FOR v_courts IN 
    SELECT id, name, sort_order
    FROM club_courts 
    WHERE user_id = v_tournament.club_owner_id AND is_active = true
    ORDER BY sort_order, name
  LOOP
    v_court_map := v_court_map || jsonb_build_object(
      (SELECT COUNT(*) FROM jsonb_object_keys(v_court_map))::text,
      v_courts.id::text
    );
  END LOOP;
  
  IF v_court_map = '{}' THEN
    RETURN 0;
  END IF;
  
  FOR v_match IN
    SELECT * FROM matches
    WHERE tournament_id = p_tournament_id
    AND scheduled_time IS NOT NULL
    AND status IN ('scheduled', 'in_progress')
  LOOP
    v_court_number := COALESCE(
      NULLIF(regexp_replace(v_match.court, '[^0-9]', '', 'g'), '')::integer - 1,
      0
    );
    
    v_court_id := (v_court_map->>LEAST(v_court_number, (SELECT COUNT(*) - 1 FROM jsonb_object_keys(v_court_map))))::uuid;
    
    IF v_court_id IS NOT NULL THEN
      PERFORM create_booking_from_match(v_match.id, v_court_id, v_tournament.club_owner_id);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Function to remove tournament bookings when tournament is cancelled or completed
CREATE OR REPLACE FUNCTION remove_tournament_bookings(p_tournament_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM court_bookings
  WHERE tournament_id = p_tournament_id
  AND event_type = 'tournament'
  RETURNING 1 INTO v_count;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Function to get tournament revenue for a club
CREATE OR REPLACE FUNCTION get_club_tournament_revenue(
  p_club_owner_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE(
  total_revenue numeric,
  total_registrations integer,
  tournaments_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(pt.amount), 0)::numeric as total_revenue,
    COUNT(DISTINCT pt.id)::integer as total_registrations,
    COUNT(DISTINCT t.id)::integer as tournaments_count
  FROM tournaments t
  JOIN clubs c ON c.id = t.club_id
  LEFT JOIN payment_transactions pt ON pt.tournament_id = t.id AND pt.status = 'succeeded'
  WHERE c.owner_id = p_club_owner_id
  AND (p_start_date IS NULL OR t.start_date >= p_start_date)
  AND (p_end_date IS NULL OR t.end_date <= p_end_date);
END;
$$;

-- Function to get member's tournament history
CREATE OR REPLACE FUNCTION get_member_tournament_history(p_member_subscription_id uuid)
RETURNS TABLE(
  tournament_id uuid,
  tournament_name text,
  start_date date,
  end_date date,
  category_name text,
  final_position integer,
  payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_account_id uuid;
  v_member_phone text;
BEGIN
  SELECT ms.player_account_id, ms.member_phone
  INTO v_player_account_id, v_member_phone
  FROM member_subscriptions ms
  WHERE ms.id = p_member_subscription_id;
  
  RETURN QUERY
  SELECT DISTINCT
    t.id as tournament_id,
    t.name as tournament_name,
    t.start_date,
    t.end_date,
    tc.name as category_name,
    p.final_position,
    p.payment_status
  FROM players p
  JOIN tournaments t ON t.id = p.tournament_id
  LEFT JOIN tournament_categories tc ON tc.id = p.category_id
  WHERE (
    (v_player_account_id IS NOT NULL AND p.user_id IN (
      SELECT pa.user_id FROM player_accounts pa WHERE pa.id = v_player_account_id
    ))
    OR
    (v_member_phone IS NOT NULL AND normalize_phone_for_matching(p.phone_number) = normalize_phone_for_matching(v_member_phone))
  )
  ORDER BY t.start_date DESC;
END;
$$;

-- Update existing members to link with player accounts
DO $$
DECLARE
  v_member RECORD;
  v_player_account_id uuid;
BEGIN
  FOR v_member IN
    SELECT id, member_phone
    FROM member_subscriptions
    WHERE member_phone IS NOT NULL AND player_account_id IS NULL
  LOOP
    SELECT id INTO v_player_account_id
    FROM player_accounts
    WHERE normalize_phone_for_matching(phone_number) = normalize_phone_for_matching(v_member.member_phone)
    LIMIT 1;
    
    IF v_player_account_id IS NOT NULL THEN
      UPDATE member_subscriptions
      SET player_account_id = v_player_account_id
      WHERE id = v_member.id;
    END IF;
  END LOOP;
END $$;
