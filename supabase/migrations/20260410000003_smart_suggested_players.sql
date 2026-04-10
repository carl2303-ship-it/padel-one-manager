/*
  # Smart Suggested Players RPC

  Returns players suggested for the community feed, prioritizing:
  1. Players you've played with (from open_game_players)
  2. Same gender (from gender column or player_category prefix M/F)
  3. Similar level (±1)
  Excludes players already followed.
*/

CREATE OR REPLACE FUNCTION get_suggested_players(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  avatar_url text,
  level numeric,
  player_category text,
  location text,
  played_together boolean
) AS $$
DECLARE
  my_gender text;
  my_level numeric;
  my_cat_prefix text;
BEGIN
  -- Get my profile
  SELECT pa.gender, pa.level,
         CASE WHEN pa.player_category IS NOT NULL AND length(pa.player_category) >= 2
              THEN left(pa.player_category, 1) ELSE NULL END
  INTO my_gender, my_level, my_cat_prefix
  FROM player_accounts pa
  WHERE pa.user_id = p_user_id
  LIMIT 1;

  -- If no explicit gender, derive from category prefix
  IF my_gender IS NULL AND my_cat_prefix IN ('M', 'F') THEN
    my_gender := CASE my_cat_prefix WHEN 'M' THEN 'male' WHEN 'F' THEN 'female' END;
  END IF;

  RETURN QUERY
  WITH my_following AS (
    SELECT f.following_id FROM follows f WHERE f.follower_id = p_user_id
  ),
  played_with AS (
    SELECT DISTINCT ogp2.user_id
    FROM open_game_players ogp1
    JOIN open_game_players ogp2 ON ogp1.game_id = ogp2.game_id
    WHERE ogp1.user_id = p_user_id
      AND ogp2.user_id != p_user_id
      AND ogp2.status = 'confirmed'
  )
  SELECT
    pa.id,
    pa.user_id,
    pa.name,
    pa.avatar_url,
    pa.level,
    pa.player_category,
    pa.location,
    (pw.user_id IS NOT NULL) AS played_together
  FROM player_accounts pa
  LEFT JOIN played_with pw ON pa.user_id = pw.user_id
  WHERE pa.user_id IS NOT NULL
    AND pa.user_id != p_user_id
    AND pa.user_id NOT IN (SELECT mf.following_id FROM my_following mf)
    -- Gender filter: match gender or category prefix
    AND (
      my_gender IS NULL
      OR pa.gender = my_gender
      OR (pa.gender IS NULL AND pa.player_category IS NOT NULL
          AND left(pa.player_category, 1) = CASE my_gender WHEN 'male' THEN 'M' WHEN 'female' THEN 'F' END)
    )
    -- Level filter: ±1 level tolerance (skip if either has no level)
    AND (
      my_level IS NULL
      OR pa.level IS NULL
      OR abs(pa.level - my_level) <= 1.5
    )
  ORDER BY
    (pw.user_id IS NOT NULL) DESC,
    CASE WHEN pa.level IS NOT NULL AND my_level IS NOT NULL
         THEN abs(pa.level - my_level) ELSE 99 END,
    pa.name
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
