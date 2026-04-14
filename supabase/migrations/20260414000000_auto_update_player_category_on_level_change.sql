-- =====================================================
-- Auto-update player_category when level changes
--
-- Scale:
--   M1/F1 = 6.5 - 7.0
--   M2/F2 = 5.5 - 6.4
--   M3/F3 = 4.5 - 5.4
--   M4/F4 = 3.5 - 4.4
--   M5/F5 = 2.5 - 3.4
--   M6/F6 = 0.0 - 2.4
--
-- Gender prefix derived from existing player_category or gender column.
-- =====================================================

-- Helper: returns the category number (1-6) for a given numeric level
CREATE OR REPLACE FUNCTION get_category_number_for_level(p_level NUMERIC)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level >= 6.5 THEN 1
    WHEN p_level >= 5.5 THEN 2
    WHEN p_level >= 4.5 THEN 3
    WHEN p_level >= 3.5 THEN 4
    WHEN p_level >= 2.5 THEN 5
    ELSE 6
  END;
$$;

-- Trigger function: sets player_category on the NEW row before the UPDATE is written
CREATE OR REPLACE FUNCTION auto_set_player_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  gender_prefix TEXT;
  cat_num INTEGER;
BEGIN
  IF NEW.level IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only act when level actually changed
  IF OLD.level IS NOT DISTINCT FROM NEW.level THEN
    RETURN NEW;
  END IF;

  -- Determine gender prefix from existing category or gender column
  IF NEW.player_category IS NOT NULL AND length(NEW.player_category) >= 2 THEN
    gender_prefix := left(NEW.player_category, 1);
  ELSIF OLD.player_category IS NOT NULL AND length(OLD.player_category) >= 2 THEN
    gender_prefix := left(OLD.player_category, 1);
  ELSIF NEW.gender = 'male' THEN
    gender_prefix := 'M';
  ELSIF NEW.gender = 'female' THEN
    gender_prefix := 'F';
  ELSE
    -- Cannot determine gender — leave category unchanged
    RETURN NEW;
  END IF;

  -- Normalize prefix
  gender_prefix := upper(gender_prefix);
  IF gender_prefix NOT IN ('M', 'F') THEN
    RETURN NEW;
  END IF;

  cat_num := get_category_number_for_level(NEW.level);
  NEW.player_category := gender_prefix || cat_num::TEXT;

  RETURN NEW;
END;
$$;

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS trg_auto_player_category ON player_accounts;

CREATE TRIGGER trg_auto_player_category
BEFORE UPDATE OF level ON player_accounts
FOR EACH ROW
EXECUTE FUNCTION auto_set_player_category();

-- =====================================================
-- Backfill: sync player_category for all existing players
-- based on their current level and gender
-- =====================================================
UPDATE player_accounts
SET player_category = (
  CASE
    WHEN player_category IS NOT NULL AND length(player_category) >= 2
      THEN left(player_category, 1)
    WHEN gender = 'male' THEN 'M'
    WHEN gender = 'female' THEN 'F'
    ELSE NULL
  END
) || get_category_number_for_level(level)::TEXT
WHERE level IS NOT NULL
  AND (
    player_category IS NOT NULL AND length(player_category) >= 2
    OR gender IN ('male', 'female')
  );
