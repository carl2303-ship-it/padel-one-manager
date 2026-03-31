-- RPC functions to manage player_transactions, bypassing RLS for staff members
-- SECURITY DEFINER runs with the function owner's privileges (postgres), so RLS is bypassed

CREATE OR REPLACE FUNCTION insert_player_transaction(
  p_club_owner_id uuid,
  p_player_name text,
  p_player_phone text,
  p_transaction_type text,
  p_amount numeric,
  p_reference_id uuid,
  p_reference_type text,
  p_notes text DEFAULT NULL,
  p_player_account_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO player_transactions (
    club_owner_id, player_name, player_phone, transaction_type,
    amount, reference_id, reference_type, notes, player_account_id
  ) VALUES (
    p_club_owner_id, p_player_name, p_player_phone, p_transaction_type,
    p_amount, p_reference_id, p_reference_type, p_notes, p_player_account_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_player_transaction(
  p_club_owner_id uuid,
  p_reference_id uuid,
  p_reference_type text,
  p_player_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM player_transactions
  WHERE club_owner_id = p_club_owner_id
    AND reference_id = p_reference_id
    AND reference_type = p_reference_type
    AND player_name = p_player_name;
END;
$$;
