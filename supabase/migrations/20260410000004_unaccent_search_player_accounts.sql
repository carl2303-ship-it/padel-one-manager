/*
  # Accent-insensitive search for player_accounts (game context)

  Similar to search_players_unaccent but includes phone_number
  and does NOT filter by user_id (tournament players may not have accounts).
*/

CREATE OR REPLACE FUNCTION search_player_accounts_unaccent(search_query text)
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  level numeric,
  player_category text,
  phone_number text
) AS $$
  SELECT pa.id, pa.name, pa.avatar_url, pa.level, pa.player_category, pa.phone_number
  FROM player_accounts pa
  WHERE public.unaccent(lower(pa.name)) LIKE '%' || public.unaccent(lower(search_query)) || '%'
  ORDER BY pa.name
  LIMIT 10;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
