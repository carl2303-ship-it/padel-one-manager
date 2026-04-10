/*
  # Accent-insensitive player search

  Enable the unaccent extension and create an RPC for searching players
  by name ignoring accents (e.g. "Seb" matches "Séb").
*/

CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

CREATE OR REPLACE FUNCTION search_players_unaccent(search_query text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  level numeric,
  player_category text,
  location text
) AS $$
  SELECT pa.id, pa.user_id, pa.name, pa.avatar_url, pa.level, pa.player_category, pa.location
  FROM player_accounts pa
  WHERE pa.user_id IS NOT NULL
    AND public.unaccent(lower(pa.name)) LIKE '%' || public.unaccent(lower(search_query)) || '%'
  ORDER BY pa.name
  LIMIT 30;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
