-- Fix transaction synchronization issues:
-- 1. Add 'tournament' and 'adjustment' to transaction_type CHECK
-- 2. Auto-delete bar transactions when bar_tab is deleted
-- 3. Auto-create tournament transactions when team payment_status = 'paid'
-- 4. Auto-create open_game transactions when player confirms with price > 0

-- 1. Update CHECK constraint to allow 'tournament' and 'adjustment'
ALTER TABLE player_transactions DROP CONSTRAINT IF EXISTS player_transactions_transaction_type_check;
ALTER TABLE player_transactions ADD CONSTRAINT player_transactions_transaction_type_check
  CHECK (transaction_type IN ('booking', 'open_game', 'academy', 'bar', 'tournament', 'adjustment'));

-- 2. Trigger: auto-delete player_transactions when bar_tab is deleted
CREATE OR REPLACE FUNCTION fn_cleanup_bar_tab_transactions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM player_transactions
    WHERE reference_id = OLD.id
    AND reference_type = 'bar_tab';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cleanup_bar_tab_transactions ON bar_tabs;
CREATE TRIGGER trg_cleanup_bar_tab_transactions
  BEFORE DELETE ON bar_tabs
  FOR EACH ROW
  EXECUTE FUNCTION fn_cleanup_bar_tab_transactions();

-- 3. Trigger: auto-create tournament transaction when team payment_status changes to 'paid'
CREATE OR REPLACE FUNCTION fn_create_tournament_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament RECORD;
  v_club RECORD;
  v_player1 RECORD;
  v_player2 RECORD;
  v_amount numeric;
BEGIN
  -- Only act when payment_status changes to 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN

    -- Get tournament info
    SELECT t.id, t.name, t.club_id, t.registration_fee
    INTO v_tournament
    FROM tournaments t
    WHERE t.id = NEW.tournament_id;

    IF v_tournament IS NULL THEN
      RETURN NEW;
    END IF;

    -- Get club owner
    SELECT c.owner_id INTO v_club
    FROM clubs c WHERE c.id = v_tournament.club_id;

    IF v_club IS NULL OR v_club.owner_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Get amount from payment_transaction or tournament price
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

    -- Get player info
    SELECT p.name, p.phone_number, p.email
    INTO v_player1
    FROM players p WHERE p.id = NEW.player1_id;

    SELECT p.name, p.phone_number, p.email
    INTO v_player2
    FROM players p WHERE p.id = NEW.player2_id;

    -- Check if transaction already exists
    IF NOT EXISTS (
      SELECT 1 FROM player_transactions
      WHERE reference_id = NEW.id
      AND reference_type = 'tournament'
      AND transaction_type = 'tournament'
    ) THEN
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
      );
    END IF;

  -- If payment_status changes FROM 'paid' to something else, remove transaction
  ELSIF OLD.payment_status = 'paid' AND NEW.payment_status != 'paid' THEN
    DELETE FROM player_transactions
      WHERE reference_id = NEW.id
      AND reference_type = 'tournament'
      AND transaction_type = 'tournament';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_tournament_transaction ON teams;
CREATE TRIGGER trg_create_tournament_transaction
  AFTER INSERT OR UPDATE OF payment_status ON teams
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_tournament_transaction();

-- 4. Trigger: auto-create open_game transaction when player confirms and there's a price
CREATE OR REPLACE FUNCTION fn_create_open_game_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_game RECORD;
  v_club RECORD;
  v_player_name text;
  v_player_phone text;
  v_player_account_id uuid;
BEGIN
  -- Only act when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN

    -- Get game info
    SELECT g.id, g.club_id, g.price_per_player, g.scheduled_at
    INTO v_game
    FROM open_games g
    WHERE g.id = NEW.game_id;

    IF v_game IS NULL OR COALESCE(v_game.price_per_player, 0) <= 0 THEN
      RETURN NEW;
    END IF;

    -- Get club owner
    SELECT c.owner_id INTO v_club
    FROM clubs c WHERE c.id = v_game.club_id;

    IF v_club IS NULL OR v_club.owner_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Get player info from player_accounts
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

    -- Check if transaction already exists for this player in this game
    IF NOT EXISTS (
      SELECT 1 FROM player_transactions
      WHERE reference_id = NEW.game_id
      AND reference_type = 'open_game'
      AND player_name = v_player_name
    ) THEN
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
      );
    END IF;

  -- If status changes FROM 'confirmed' to something else (cancelled), remove transaction
  ELSIF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    -- Get player name to match
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

DROP TRIGGER IF EXISTS trg_create_open_game_transaction ON open_game_players;
CREATE TRIGGER trg_create_open_game_transaction
  AFTER INSERT OR UPDATE OF status ON open_game_players
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_open_game_transaction();

-- 5. Clean up orphaned bar transactions (bar_tabs that no longer exist or weren't paid)
DELETE FROM player_transactions pt
WHERE pt.reference_type = 'bar_tab'
AND NOT EXISTS (
  SELECT 1 FROM bar_tabs bt
  WHERE bt.id = pt.reference_id
  AND bt.payment_status = 'paid'
);

-- 6. Backfill: create transactions for existing paid teams that don't have one
INSERT INTO player_transactions (
  club_owner_id, player_name, player_phone,
  transaction_type, amount, reference_id, reference_type,
  notes, transaction_date
)
SELECT
  c.owner_id,
  COALESCE(p1.name, '') || ' / ' || COALESCE(p2.name, ''),
  COALESCE(p1.phone_number, p1.email, 'N/A'),
  'tournament',
  COALESCE(
    (SELECT pt2.amount FROM payment_transactions pt2 WHERE pt2.id = t.payment_transaction_id),
    tn.registration_fee,
    0
  ),
  t.id,
  'tournament',
  'Torneio: ' || tn.name || ' — ' || COALESCE(t.name, ''),
  COALESCE(t.created_at, now())
FROM teams t
JOIN tournaments tn ON tn.id = t.tournament_id
JOIN clubs c ON c.id = tn.club_id
LEFT JOIN players p1 ON p1.id = t.player1_id
LEFT JOIN players p2 ON p2.id = t.player2_id
WHERE t.payment_status = 'paid'
AND c.owner_id IS NOT NULL
AND COALESCE(
  (SELECT pt3.amount FROM payment_transactions pt3 WHERE pt3.id = t.payment_transaction_id),
  tn.registration_fee,
  0
) > 0
AND NOT EXISTS (
  SELECT 1 FROM player_transactions ptx
  WHERE ptx.reference_id = t.id
  AND ptx.reference_type = 'tournament'
);

-- 7. Backfill: create transactions for existing confirmed open_game_players with price > 0
INSERT INTO player_transactions (
  club_owner_id, player_account_id, player_name, player_phone,
  transaction_type, amount, reference_id, reference_type,
  notes, transaction_date
)
SELECT
  c.owner_id,
  ogp.player_account_id,
  COALESCE(pa.name, 'Jogador'),
  COALESCE(pa.phone_number, 'N/A'),
  'open_game',
  og.price_per_player,
  ogp.game_id,
  'open_game',
  'Jogo Aberto — ' || to_char(og.scheduled_at AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI'),
  COALESCE(ogp.created_at, now())
FROM open_game_players ogp
JOIN open_games og ON og.id = ogp.game_id
JOIN clubs c ON c.id = og.club_id
LEFT JOIN player_accounts pa ON pa.id = ogp.player_account_id
WHERE ogp.status = 'confirmed'
AND c.owner_id IS NOT NULL
AND COALESCE(og.price_per_player, 0) > 0
AND NOT EXISTS (
  SELECT 1 FROM player_transactions ptx
  WHERE ptx.reference_id = ogp.game_id
  AND ptx.reference_type = 'open_game'
  AND ptx.player_name = COALESCE(pa.name, 'Jogador')
);
