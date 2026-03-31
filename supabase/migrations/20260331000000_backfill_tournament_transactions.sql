-- Backfill missing player_transactions for tournament players marked as 'paid'
-- Uses the same pricing priority as the app:
-- Member: cat.member_price > tourn.member_price > cat.registration_fee > tourn.registration_fee
-- Non-member: cat.non_member_price > tourn.non_member_price > cat.registration_fee > tourn.registration_fee

INSERT INTO player_transactions (club_owner_id, player_name, player_phone, transaction_type, amount, reference_id, reference_type, notes, transaction_date)
SELECT
  cl.owner_id AS club_owner_id,
  p.name AS player_name,
  COALESCE(p.phone_number, 'unknown') AS player_phone,
  'booking' AS transaction_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM member_subscriptions ms
      WHERE ms.club_owner_id = cl.owner_id
        AND ms.member_phone = p.phone_number
        AND ms.status = 'active'
    ) THEN COALESCE(
      NULLIF(tc.member_price, 0),
      NULLIF(t.member_price, 0),
      NULLIF(tc.registration_fee, 0),
      NULLIF(t.registration_fee, 0),
      0
    )
    ELSE COALESCE(
      NULLIF(tc.non_member_price, 0),
      NULLIF(t.non_member_price, 0),
      NULLIF(tc.registration_fee, 0),
      NULLIF(t.registration_fee, 0),
      0
    )
  END AS amount,
  p.tournament_id AS reference_id,
  'tournament' AS reference_type,
  'Torneio: ' || t.name || COALESCE(' - ' || tc.name, '') AS notes,
  t.start_date AS transaction_date
FROM players p
JOIN tournaments t ON t.id = p.tournament_id
JOIN clubs cl ON cl.id = t.club_id
LEFT JOIN tournament_categories tc ON tc.id = p.category_id
WHERE p.payment_status = 'paid'
  AND (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM member_subscriptions ms
        WHERE ms.club_owner_id = cl.owner_id
          AND ms.member_phone = p.phone_number
          AND ms.status = 'active'
      ) THEN COALESCE(
        NULLIF(tc.member_price, 0),
        NULLIF(t.member_price, 0),
        NULLIF(tc.registration_fee, 0),
        NULLIF(t.registration_fee, 0),
        0
      )
      ELSE COALESCE(
        NULLIF(tc.non_member_price, 0),
        NULLIF(t.non_member_price, 0),
        NULLIF(tc.registration_fee, 0),
        NULLIF(t.registration_fee, 0),
        0
      )
    END
  ) > 0
  AND NOT EXISTS (
    SELECT 1 FROM player_transactions pt
    WHERE pt.reference_id = p.tournament_id
      AND pt.reference_type = 'tournament'
      AND pt.player_name = p.name
      AND pt.club_owner_id = cl.owner_id
  );
