-- Prevent duplicate transactions and fix RPC

-- 1. Unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_transactions_unique
  ON player_transactions (player_name, reference_id, reference_type)
  WHERE reference_id IS NOT NULL;

-- 2. Update RPC to use ON CONFLICT (upsert instead of duplicate insert)
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
  ON CONFLICT (player_name, reference_id, reference_type) WHERE reference_id IS NOT NULL
  DO UPDATE SET amount = EXCLUDED.amount, notes = EXCLUDED.notes, transaction_date = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3. Also update the open game trigger to use ON CONFLICT
CREATE OR REPLACE FUNCTION fn_create_open_game_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_game RECORD;
  v_club RECORD;
  v_player_name text;
  v_player_phone text;
  v_player_account_id uuid;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    SELECT g.id, g.club_id, g.price_per_player, g.scheduled_at
    INTO v_game
    FROM open_games g
    WHERE g.id = NEW.game_id;

    IF v_game IS NULL OR COALESCE(v_game.price_per_player, 0) <= 0 THEN
      RETURN NEW;
    END IF;

    SELECT c.owner_id INTO v_club
    FROM clubs c WHERE c.id = v_game.club_id;

    IF v_club IS NULL OR v_club.owner_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_player_account_id := NEW.player_account_id;
    v_player_name := 'Jogador';
    v_player_phone := 'N/A';

    IF v_player_account_id IS NOT NULL THEN
      SELECT pa.name, pa.phone_number
      INTO v_player_name, v_player_phone
      FROM player_accounts pa WHERE pa.id = v_player_account_id;
      v_player_name := COALESCE(v_player_name, 'Jogador');
      v_player_phone := COALESCE(v_player_phone, 'N/A');
    END IF;

    INSERT INTO player_transactions (
      club_owner_id, player_account_id, player_name, player_phone,
      transaction_type, amount, reference_id, reference_type,
      notes, transaction_date
    ) VALUES (
      v_club.owner_id,
      v_player_account_id,
      v_player_name,
      COALESCE(v_player_phone, 'N/A'),
      'open_game',
      v_game.price_per_player,
      NEW.game_id,
      'open_game',
      'Jogo Aberto — ' || to_char(v_game.scheduled_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI'),
      now()
    )
    ON CONFLICT (player_name, reference_id, reference_type) WHERE reference_id IS NOT NULL
    DO NOTHING;

  ELSIF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    IF NEW.player_account_id IS NOT NULL THEN
      SELECT pa.name INTO v_player_name
      FROM player_accounts pa WHERE pa.id = NEW.player_account_id;
    END IF;
    DELETE FROM player_transactions
      WHERE reference_id = NEW.game_id
      AND reference_type = 'open_game'
      AND player_name = COALESCE(v_player_name, 'Jogador');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Also update tournament trigger to use ON CONFLICT
CREATE OR REPLACE FUNCTION fn_create_tournament_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament RECORD;
  v_club RECORD;
  v_player1 RECORD;
  v_player2 RECORD;
  v_amount numeric;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN

    SELECT t.id, t.name, t.club_id, t.registration_fee
    INTO v_tournament
    FROM tournaments t
    WHERE t.id = NEW.tournament_id;

    IF v_tournament IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT c.owner_id INTO v_club
    FROM clubs c WHERE c.id = v_tournament.club_id;

    IF v_club IS NULL OR v_club.owner_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.payment_transaction_id IS NOT NULL THEN
      SELECT pt.amount INTO v_amount
      FROM payment_transactions pt
      WHERE pt.id = NEW.payment_transaction_id;
    ELSE
      v_amount := COALESCE(v_tournament.registration_fee, 0);
    END IF;

    IF v_amount <= 0 THEN
      RETURN NEW;
    END IF;

    SELECT p.name, p.phone_number, p.email
    INTO v_player1
    FROM players p WHERE p.id = NEW.player1_id;

    SELECT p.name, p.phone_number, p.email
    INTO v_player2
    FROM players p WHERE p.id = NEW.player2_id;

    INSERT INTO player_transactions (
      club_owner_id, player_name, player_phone,
      transaction_type, amount, reference_id, reference_type,
      notes, transaction_date
    ) VALUES (
      v_club.owner_id,
      COALESCE(v_player1.name, '') || ' / ' || COALESCE(v_player2.name, ''),
      COALESCE(v_player1.phone_number, v_player1.email, 'N/A'),
      'tournament',
      v_amount,
      NEW.id,
      'tournament',
      'Torneio: ' || v_tournament.name || ' — ' || COALESCE(NEW.name, ''),
      now()
    )
    ON CONFLICT (player_name, reference_id, reference_type) WHERE reference_id IS NOT NULL
    DO UPDATE SET amount = EXCLUDED.amount;

  ELSIF OLD.payment_status = 'paid' AND NEW.payment_status != 'paid' THEN
    DELETE FROM player_transactions
      WHERE reference_id = NEW.id
      AND reference_type = 'tournament'
      AND transaction_type = 'tournament';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Auto-delete open_game_players transactions when open_game is deleted
CREATE OR REPLACE FUNCTION fn_cleanup_open_game_transactions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM player_transactions
    WHERE reference_id = OLD.id
    AND reference_type = 'open_game';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cleanup_open_game_transactions ON open_games;
CREATE TRIGGER trg_cleanup_open_game_transactions
  BEFORE DELETE ON open_games
  FOR EACH ROW
  EXECUTE FUNCTION fn_cleanup_open_game_transactions();
