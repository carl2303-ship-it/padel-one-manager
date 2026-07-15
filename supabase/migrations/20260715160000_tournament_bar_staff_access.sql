/*
  # Tournament bar tab: staff + RPC access

  Club staff with bar/bookings access need to list tournaments linked to their club
  and manage player payment status for the bar integration.
*/

-- Staff can view tournaments linked to their club (bar / reception / admin)
CREATE POLICY "Staff can view club linked tournaments"
  ON tournaments
  FOR SELECT
  TO authenticated
  USING (
    club_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM club_staff cs
      INNER JOIN clubs c ON c.owner_id = cs.club_owner_id AND c.id = tournaments.club_id
      WHERE cs.user_id = auth.uid()
        AND cs.is_active = true
        AND (
          cs.perm_bar = true
          OR cs.perm_bookings = true
          OR cs.role IN ('admin', 'kitchen', 'bar_staff', 'receptionist')
        )
    )
  );

-- Staff can view players in club-linked tournaments
CREATE POLICY "Staff can view club linked tournament players"
  ON players
  FOR SELECT
  TO authenticated
  USING (
    tournament_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM tournaments t
      INNER JOIN clubs c ON c.id = t.club_id
      INNER JOIN club_staff cs ON cs.club_owner_id = c.owner_id
      WHERE t.id = players.tournament_id
        AND cs.user_id = auth.uid()
        AND cs.is_active = true
        AND (
          cs.perm_bar = true
          OR cs.perm_bookings = true
          OR cs.role IN ('admin', 'kitchen', 'bar_staff', 'receptionist')
        )
    )
  );

-- Staff can update payment_status for club-linked tournament players
CREATE POLICY "Staff can update club linked tournament players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (
    tournament_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM tournaments t
      INNER JOIN clubs c ON c.id = t.club_id
      INNER JOIN club_staff cs ON cs.club_owner_id = c.owner_id
      WHERE t.id = players.tournament_id
        AND cs.user_id = auth.uid()
        AND cs.is_active = true
        AND (
          cs.perm_bar = true
          OR cs.perm_bookings = true
          OR cs.role IN ('admin', 'kitchen', 'bar_staff', 'receptionist')
        )
    )
  )
  WITH CHECK (
    tournament_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM tournaments t
      INNER JOIN clubs c ON c.id = t.club_id
      INNER JOIN club_staff cs ON cs.club_owner_id = c.owner_id
      WHERE t.id = players.tournament_id
        AND cs.user_id = auth.uid()
        AND cs.is_active = true
        AND (
          cs.perm_bar = true
          OR cs.perm_bookings = true
          OR cs.role IN ('admin', 'kitchen', 'bar_staff', 'receptionist')
        )
    )
  );

-- Staff can view categories for club-linked tournaments
CREATE POLICY "Staff can view club linked tournament categories"
  ON tournament_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tournaments t
      INNER JOIN clubs c ON c.id = t.club_id
      INNER JOIN club_staff cs ON cs.club_owner_id = c.owner_id
      WHERE t.id = tournament_categories.tournament_id
        AND cs.user_id = auth.uid()
        AND cs.is_active = true
        AND (
          cs.perm_bar = true
          OR cs.perm_bookings = true
          OR cs.role IN ('admin', 'kitchen', 'bar_staff', 'receptionist')
        )
    )
  );

-- RPC: list tournaments for manager bar tab (bypasses RLS edge cases)
CREATE OR REPLACE FUNCTION get_club_tournaments_for_bar(p_club_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  start_date date,
  end_date date,
  status text,
  player_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.start_date,
    t.end_date,
    t.status,
    COUNT(p.id) AS player_count
  FROM tournaments t
  LEFT JOIN players p ON p.tournament_id = t.id
  WHERE t.club_id = p_club_id
    AND t.status IS DISTINCT FROM 'cancelled'
    AND (
      EXISTS (
        SELECT 1 FROM clubs c
        WHERE c.id = p_club_id AND c.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM club_staff cs
        INNER JOIN clubs c ON c.owner_id = cs.club_owner_id AND c.id = p_club_id
        WHERE cs.user_id = auth.uid()
          AND cs.is_active = true
          AND (
            cs.perm_bar = true
            OR cs.perm_bookings = true
            OR cs.role IN ('admin', 'kitchen', 'bar_staff', 'receptionist')
          )
      )
    )
  GROUP BY t.id, t.name, t.start_date, t.end_date, t.status
  ORDER BY t.start_date DESC NULLS LAST
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION get_club_tournaments_for_bar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_club_tournaments_for_bar(uuid) TO authenticated;
