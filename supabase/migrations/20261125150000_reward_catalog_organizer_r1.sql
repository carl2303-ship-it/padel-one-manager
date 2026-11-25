-- R1: rewards scope for independent organizers
-- club_id nullable + organizer_id; unique partial indexes; RLS; award_reward_points supports organizer.

-- 1) reward_catalog
ALTER TABLE public.reward_catalog ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.reward_catalog
  ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reward_catalog DROP CONSTRAINT IF EXISTS reward_catalog_scope_chk;
ALTER TABLE public.reward_catalog
  ADD CONSTRAINT reward_catalog_scope_chk
  CHECK (club_id IS NOT NULL OR organizer_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS reward_catalog_organizer_id_idx
  ON public.reward_catalog (organizer_id)
  WHERE organizer_id IS NOT NULL;

DROP POLICY IF EXISTS "Organizer can manage own catalog" ON public.reward_catalog;
CREATE POLICY "Organizer can manage own catalog" ON public.reward_catalog
  FOR ALL TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- 2) reward_rules
ALTER TABLE public.reward_rules ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.reward_rules
  ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reward_rules DROP CONSTRAINT IF EXISTS reward_rules_scope_chk;
ALTER TABLE public.reward_rules
  ADD CONSTRAINT reward_rules_scope_chk
  CHECK (club_id IS NOT NULL OR organizer_id IS NOT NULL);

ALTER TABLE public.reward_rules DROP CONSTRAINT IF EXISTS reward_rules_club_id_action_type_key;
DROP INDEX IF EXISTS reward_rules_club_id_action_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS reward_rules_club_action_uidx
  ON public.reward_rules (club_id, action_type)
  WHERE club_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reward_rules_organizer_action_uidx
  ON public.reward_rules (organizer_id, action_type)
  WHERE organizer_id IS NOT NULL;

DROP POLICY IF EXISTS "Organizer can manage own reward rules" ON public.reward_rules;
CREATE POLICY "Organizer can manage own reward rules" ON public.reward_rules
  FOR ALL TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- 3) reward_redemptions
ALTER TABLE public.reward_redemptions ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.reward_redemptions
  ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reward_redemptions DROP CONSTRAINT IF EXISTS reward_redemptions_scope_chk;
ALTER TABLE public.reward_redemptions
  ADD CONSTRAINT reward_redemptions_scope_chk
  CHECK (club_id IS NOT NULL OR organizer_id IS NOT NULL);

DROP POLICY IF EXISTS "Organizer can view/update own redemptions" ON public.reward_redemptions;
CREATE POLICY "Organizer can view/update own redemptions" ON public.reward_redemptions
  FOR ALL TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- 4) player_rewards
ALTER TABLE public.player_rewards ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.player_rewards
  ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.player_rewards DROP CONSTRAINT IF EXISTS player_rewards_scope_chk;
ALTER TABLE public.player_rewards
  ADD CONSTRAINT player_rewards_scope_chk
  CHECK (club_id IS NOT NULL OR organizer_id IS NOT NULL);

ALTER TABLE public.player_rewards DROP CONSTRAINT IF EXISTS player_rewards_player_account_id_club_id_key;
DROP INDEX IF EXISTS player_rewards_player_account_id_club_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS player_rewards_player_club_uidx
  ON public.player_rewards (player_account_id, club_id)
  WHERE club_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS player_rewards_player_organizer_uidx
  ON public.player_rewards (player_account_id, organizer_id)
  WHERE organizer_id IS NOT NULL;

-- 5) reward_transactions
ALTER TABLE public.reward_transactions ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.reward_transactions
  ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6) award_reward_points — support organizer scope (6th arg optional)
DROP FUNCTION IF EXISTS public.award_reward_points(uuid, uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.award_reward_points(uuid, uuid, text, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.award_reward_points(
  p_player_account_id uuid,
  p_club_id uuid,
  p_action_type text,
  p_reference_id uuid DEFAULT NULL,
  p_custom_description text DEFAULT NULL,
  p_organizer_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule RECORD;
  v_points INT;
  v_new_total INT;
  v_tier TEXT;
  v_dup boolean := false;
BEGIN
  IF p_club_id IS NOT NULL THEN
    SELECT * INTO v_rule FROM reward_rules
    WHERE club_id = p_club_id AND action_type = p_action_type AND is_active = TRUE;
  ELSIF p_organizer_id IS NOT NULL THEN
    SELECT * INTO v_rule FROM reward_rules
    WHERE organizer_id = p_organizer_id AND action_type = p_action_type AND is_active = TRUE;
  ELSE
    RETURN json_build_object('success', false, 'error', 'club_id ou organizer_id obrigatório');
  END IF;

  IF v_rule.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sem regra de reward configurada para esta ação');
  END IF;

  v_points := v_rule.points;

  IF p_reference_id IS NOT NULL THEN
    IF p_club_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM reward_transactions
        WHERE player_account_id = p_player_account_id
          AND club_id = p_club_id
          AND action_type = p_action_type
          AND reference_id = p_reference_id
      ) INTO v_dup;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM reward_transactions
        WHERE player_account_id = p_player_account_id
          AND organizer_id = p_organizer_id
          AND action_type = p_action_type
          AND reference_id = p_reference_id
      ) INTO v_dup;
    END IF;
    IF v_dup THEN
      RETURN json_build_object('success', false, 'error', 'Pontos já atribuídos para esta ação');
    END IF;
  END IF;

  INSERT INTO reward_transactions (
    player_account_id, club_id, organizer_id, action_type, points, description, reference_id
  ) VALUES (
    p_player_account_id, p_club_id, p_organizer_id, p_action_type, v_points,
    COALESCE(p_custom_description, v_rule.description), p_reference_id
  );

  IF p_club_id IS NOT NULL THEN
    UPDATE player_rewards
    SET total_points = total_points + v_points, updated_at = now()
    WHERE player_account_id = p_player_account_id AND club_id = p_club_id
    RETURNING total_points INTO v_new_total;

    IF NOT FOUND THEN
      INSERT INTO player_rewards (player_account_id, club_id, total_points)
      VALUES (p_player_account_id, p_club_id, v_points)
      RETURNING total_points INTO v_new_total;
    END IF;
  ELSE
    UPDATE player_rewards
    SET total_points = total_points + v_points, updated_at = now()
    WHERE player_account_id = p_player_account_id AND organizer_id = p_organizer_id
    RETURNING total_points INTO v_new_total;

    IF NOT FOUND THEN
      INSERT INTO player_rewards (player_account_id, organizer_id, total_points)
      VALUES (p_player_account_id, p_organizer_id, v_points)
      RETURNING total_points INTO v_new_total;
    END IF;
  END IF;

  v_tier := CASE
    WHEN v_new_total >= 1000 THEN 'diamond'
    WHEN v_new_total >= 500 THEN 'platinum'
    WHEN v_new_total >= 200 THEN 'gold'
    ELSE 'silver'
  END;

  IF p_club_id IS NOT NULL THEN
    UPDATE player_rewards SET tier = v_tier
    WHERE player_account_id = p_player_account_id AND club_id = p_club_id;
  ELSE
    UPDATE player_rewards SET tier = v_tier
    WHERE player_account_id = p_player_account_id AND organizer_id = p_organizer_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'points_earned', v_points,
    'new_total', v_new_total,
    'tier', v_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_reward_points(uuid, uuid, text, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_reward_points(uuid, uuid, text, uuid, text, uuid) TO service_role;
